import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

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
        // Get IP address from request
        const ipAddress = ctx.req.ip || ctx.req.headers['x-forwarded-for'] as string || 'unknown';
        const userAgent = ctx.req.headers['user-agent'] || null;

        const responseId = await db.submitResponse(
          input.questionId,
          input.facilityId,
          ipAddress,
          userAgent,
          input.answers
        );

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
          redirectToHome 
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
        const ipAddress = ctx.req.ip || ctx.req.headers['x-forwarded-for'] as string || 'unknown';
        const userAgent = ctx.req.headers['user-agent'] || null;

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
});

export type AppRouter = typeof appRouter;
