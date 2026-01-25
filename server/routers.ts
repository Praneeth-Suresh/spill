import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import type { TrpcContext } from "./_core/context";
import { responses } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { experimentsRouter } from "./routers/experiments";

/**
 * Admin-only procedure that checks if user has admin or super_admin role.
 * Throws FORBIDDEN error if user is not an admin.
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'super_admin') {
    throw new TRPCError({ 
      code: 'FORBIDDEN',
      message: 'Admin access required'
    });
  }
  return next({ ctx });
});

/**
 * Super admin-only procedure for privileged operations.
 * Throws FORBIDDEN error if user is not a super admin.
 */
const superAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'super_admin') {
    throw new TRPCError({ 
      code: 'FORBIDDEN',
      message: 'Super admin access required'
    });
  }
  return next({ ctx });
});

const DEFAULT_POINTS = Number(process.env.VITE_DEFAULT_POINTS ?? 0);

async function resolvePointsSnapshot(ctx: TrpcContext) {
  if (ctx.user) {
    const user = await db.getUserByOpenId(ctx.user.openId);
    if (user) {
      return { source: 'user' as const, points: user.points ?? 0 };
    }
  }

  if (ctx.ipAddress) {
    const ipPoints = await db.getPointsByIp(ctx.ipAddress);
    if (ipPoints) {
      return { source: 'ip' as const, points: ipPoints.points ?? 0 };
    }
  }

  return { source: 'default' as const, points: DEFAULT_POINTS };
}

const serializeUpdate = (item: { id: number; date: Date; person: string; content: string; relevance: number | null }) => ({
  id: item.id,
  date: item.date,
  person: item.person,
  questionId: item.relevance ?? null,
  paragraphs: item.content.split(/\n\n+/).filter(Boolean),
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    /**
     * Get current authenticated user.
     * Returns null if not logged in.
     */
    me: publicProcedure.query(opts => opts.ctx.user),
    
    /**
     * Logout current user by clearing session cookie.
     */
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  /**
   * Public question and response submission endpoints.
   * No authentication required for users to submit feedback.
   */
  questions: router({
    /**
     * Get a question by ID with its options.
     * Public endpoint for displaying questions to users.
     */
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const result = await db.getQuestionById(input.id);
        if (!result) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Question not found' });
        }
        return result;
      }),

    /**
     * Get all active questions for a facility.
     * Used for displaying available questions.
     */
    getByFacility: publicProcedure
      .input(z.object({ facilityId: z.number() }))
      .query(async ({ input }) => {
        return await db.getQuestionsByFacility(input.facilityId);
      }),

    /**
     * Submit a response to a question.
     * Captures IP address and user agent for logging.
     */
    submit: publicProcedure
      .input(z.object({
        questionId: z.number(),
        facilityId: z.number(),
        answers: z.array(z.object({
          optionId: z.number().optional(),
          textAnswer: z.string().optional(),
          fileId: z.number().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const questionRecord = await db.getQuestionById(input.questionId);
        if (!questionRecord) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Question not found' });
        }

        const ipAddress = ctx.ipAddress;
        const userAgent = ctx.userAgent;

        const responseId = await db.submitResponse(
          input.questionId,
          input.facilityId,
          ipAddress ?? 'unknown',
          userAgent,
          input.answers
        );

        const pointsToAward = questionRecord.question.pointsAwarded ?? 0;

        if (!ipAddress) {
          console.warn("IP address not found: not updating points");
        } else if (pointsToAward !== 0) {
          await db.incrementPointsByIp(ipAddress, pointsToAward);
        }

        if (ipAddress) {
          await db.recordIpActivity(ipAddress);
        }

        if (ctx.user && pointsToAward !== 0) {
          await db.incrementUserPoints(ctx.user.id, pointsToAward);
        }

        const pointsSnapshot = await resolvePointsSnapshot(ctx);

        // Evaluate branching logic
        const { evaluateNextQuestion } = await import('./branching');
        const selectedOptionIds = input.answers
          .filter(a => a.optionId)
          .map(a => a.optionId!);
        
        const { nextQuestionId, redirectToHome } = await evaluateNextQuestion(
          input.questionId,
          selectedOptionIds
        );

        return { 
          success: true, 
          responseId, 
          nextQuestionId,
          redirectToHome,
          points: pointsSnapshot,
        };
      }),

    /**
     * Upload a file for file upload questions.
     * Returns file ID to be included in response submission.
     */
    uploadFile: publicProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // Base64 encoded file data
        mimeType: z.string(),
        questionId: z.number(),
        facilityId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Decode base64 file data
        const fileBuffer = Buffer.from(input.fileData, 'base64');
        const fileSize = fileBuffer.length;

        // Generate unique file key
        const fileKey = `uploads/${input.facilityId}/${input.questionId}/${nanoid()}-${input.fileName}`;

        // Upload to S3
        const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);

        // Get IP address for logging
        const ipAddress = ctx.ipAddress ?? 'unknown';
        const userAgent = ctx.userAgent;

        // Create temporary response record (will be linked later)
        const responseId = await db.submitResponse(
          input.questionId,
          input.facilityId,
          ipAddress,
          userAgent,
          []
        );

        // Store file metadata in database
        const dbInstance = await db.getDb();
        if (!dbInstance) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        const { uploadedFiles } = await import('../drizzle/schema');
        const [file] = await dbInstance.insert(uploadedFiles).values({
          responseId,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          mimeType: input.mimeType,
          fileSize,
          uploadedAt: new Date(),
        });

        return { fileId: file.insertId, fileUrl: url };
      }),

    /**
     * Get response count for a question.
     */
    getResponseCount: publicProcedure
      .input(z.object({ questionId: z.number() }))
      .query(async ({ input }) => {
        const dbInstance = await db.getDb();
        if (!dbInstance) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const result = await dbInstance
          .select({ count: sql<number>`count(*)` })
          .from(responses)
          .where(eq(responses.questionId, input.questionId));

        const count = Number(result[0]?.count ?? 0);
        return { count };
      }),
  }),

  /**
   * Public facilities endpoint.
   */
  facilities: router({
    /**
     * Get all active facilities.
     * Public endpoint for displaying facility list.
     */
    getAll: publicProcedure.query(async () => {
      return await db.getAllActiveFacilities();
    }),
  }),

  /**
   * Points endpoints for displaying balances.
   */
  points: router({
    current: publicProcedure.query(async ({ ctx }) => {
      return resolvePointsSnapshot(ctx);
    }),
  }),

  updates: router({
    /**
     * Fetch newest updates for the feed. Requires that the requester has answered today.
     */
    top: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.ipAddress) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'IP address required' });
      }

      const allowed = await db.hasIpActivityToday(ctx.ipAddress, new Date());
      if (!allowed) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No recent activity' });
      }

      const items = await db.getLatestUpdates();

      return items.map(serializeUpdate);
    }),

    /**
     * Fetch updates scoped to a specific question by storing its id in the relevance column.
     */
    byQuestion: publicProcedure
      .input(z.object({
        questionId: z.number(),
        limit: z.number().min(1).max(50).default(5),
      }))
      .query(async ({ input }) => {
        const items = await db.getUpdatesByQuestion(input.questionId, input.limit);

        return items.map(serializeUpdate);
      }),

    /**
     * Fetch the newest updates without gating; used for general results landing page.
     */
    latest: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(3) }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit ?? 3;
        const items = await db.getLatestUpdates(limit);

        return items.map(serializeUpdate);
      }),
  }),

  /**
   * Admin-only endpoints for dashboard and analytics.
   */
  admin: router({
    /**
     * Get facilities accessible to current admin.
     * Super admins see all, regular admins see assigned only.
     */
    getFacilities: adminProcedure.query(async ({ ctx }) => {
      return await db.getUserFacilities(ctx.user.id, ctx.user.role);
    }),

    /**
     * Get all questions for a facility (including inactive) for admin dashboards.
     */
    getFacilityQuestions: adminProcedure
      .input(z.object({ facilityId: z.number() }))
      .query(async ({ input, ctx }) => {
        const facilities = await db.getUserFacilities(ctx.user.id, ctx.user.role);
        const hasAccess = facilities.some(f => f.id === input.facilityId);

        if (!hasAccess) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied to this facility' });
        }

        return await db.getAllQuestionsByFacility(input.facilityId);
      }),

    /**
     * Get statistics for a facility.
     * Admins can only access their assigned facilities.
     */
    getFacilityStats: adminProcedure
      .input(z.object({
        facilityId: z.number(),
        timeRange: z.enum(['week', 'month', 'all']).default('week'),
      }))
      .query(async ({ input, ctx }) => {
        // Check access permission
        const facilities = await db.getUserFacilities(ctx.user.id, ctx.user.role);
        const hasAccess = facilities.some(f => f.id === input.facilityId);
        
        if (!hasAccess) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied to this facility' });
        }

        return await db.getFacilityStats(input.facilityId, input.timeRange);
      }),

    /**
     * Combined facility snapshot that batches stats and questions.
     * Reduces round trips from the admin dashboard.
     */
    getFacilitySnapshot: adminProcedure
      .input(z.object({
        facilityId: z.number(),
        timeRange: z.enum(['week', 'month', 'all']).default('week'),
      }))
      .query(async ({ input, ctx }) => {
        const facilities = await db.getUserFacilities(ctx.user.id, ctx.user.role);
        const hasAccess = facilities.some(f => f.id === input.facilityId);

        if (!hasAccess) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied to this facility' });
        }

        const [stats, questions] = await Promise.all([
          db.getFacilityStats(input.facilityId, input.timeRange),
          db.getAllQuestionsByFacility(input.facilityId),
        ]);

        return { stats, questions } as const;
      }),

    /**
     * Get question statistics (response counts and breakdowns).
     */
    getQuestionStats: adminProcedure
      .input(z.object({ questionId: z.number() }))
      .query(async ({ input, ctx }) => {
        // Verify admin has access to this question's facility
        const question = await db.getQuestionById(input.questionId);
        if (!question) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Question not found' });
        }

        const facilities = await db.getUserFacilities(ctx.user.id, ctx.user.role);
        const hasAccess = facilities.some(f => f.id === question.question.facilityId);
        
        if (!hasAccess) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied to this question' });
        }

        return await db.getQuestionStats(input.questionId);
      }),

    /**
     * Get recent text responses for a question.
     */
    getRecentResponses: adminProcedure
      .input(z.object({
        questionId: z.number(),
        limit: z.number().default(10),
      }))
      .query(async ({ input, ctx }) => {
        // Verify admin has access to this question's facility
        const question = await db.getQuestionById(input.questionId);
        if (!question) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Question not found' });
        }

        const facilities = await db.getUserFacilities(ctx.user.id, ctx.user.role);
        const hasAccess = facilities.some(f => f.id === question.question.facilityId);
        
        if (!hasAccess) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied to this question' });
        }

        return await db.getRecentTextResponses(input.questionId, input.limit);
      }),

    /**
     * Export responses as CSV or JSON.
     * Admins can only export data from their assigned facilities.
     */
    exportResponses: adminProcedure
      .input(z.object({
        facilityIds: z.array(z.number()),
        format: z.enum(['csv', 'json']),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Verify admin has access to all requested facilities
        const facilities = await db.getUserFacilities(ctx.user.id, ctx.user.role);
        const accessibleIds = facilities.map(f => f.id);
        
        const hasAccess = input.facilityIds.every(id => accessibleIds.includes(id));
        if (!hasAccess) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied to some facilities' });
        }

        const data = await db.exportResponses(input.facilityIds, input.startDate, input.endDate);

        if (input.format === 'csv') {
          // Convert to CSV format
          const headers = ['Response ID', 'Facility', 'Question', 'Type', 'Answer', 'IP Address', 'Submitted At'];
          const rows = data.map(r => [
            r.responseId,
            r.facilityName,
            r.questionTitle,
            r.questionType,
            r.answer,
            r.ipAddress,
            r.submittedAt.toISOString(),
          ]);
          
          const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
          ].join('\n');

          return { format: 'csv' as const, data: csv };
        } else {
          // Return as JSON
          return { format: 'json' as const, data: JSON.stringify(data, null, 2) };
        }
      }),

    /**
     * Assign an admin to a facility (super admin only).
     */
    assignAdmin: superAdminProcedure
      .input(z.object({
        userId: z.number(),
        facilityId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.assignAdminToFacility(input.userId, input.facilityId, ctx.user.id);
        return { success: true };
      }),

    /**
     * Get all admins assigned to a facility (super admin only).
     */
    getFacilityAdmins: superAdminProcedure
      .input(z.object({ facilityId: z.number() }))
      .query(async ({ input }) => {
        return await db.getFacilityAdmins(input.facilityId);
      }),
  }),
  
  /**
   * Experiments router for A/B testing
   */
  experiments: experimentsRouter,
});

export type AppRouter = typeof appRouter;
