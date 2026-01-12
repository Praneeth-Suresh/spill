import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import * as db from '../db';
import { experiments } from '../../drizzle/schema';

/**
 * Experiments router for A/B testing with GrowthBook
 * Provides endpoints for managing experiments and tracking exposures
 */
export const experimentsRouter = router({
  /**
   * Get GrowthBook configuration for the current page/question
   * This is called by the frontend to initialize GrowthBook
   */
  getConfig: publicProcedure
    .input(z.object({
      pagePath: z.string().optional(),
      questionId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return await db.getGrowthBookConfig(input.pagePath, input.questionId);
    }),
  
  /**
   * Track when a user is exposed to an experiment
   * Called by GrowthBook's trackingCallback
   */
  trackExposure: publicProcedure
    .input(z.object({
      deviceId: z.string(),
      sessionId: z.string(),
      experimentKey: z.string(),
      variationId: z.string(),
      pagePath: z.string().optional(),
      questionId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const ipAddress = ctx.req.ip || ctx.req.headers['x-forwarded-for'] || 'unknown';
      const userAgent = ctx.req.headers['user-agent'] || '';
      
      await db.trackExposure({
        deviceId: input.deviceId,
        sessionId: input.sessionId,
        experimentKey: input.experimentKey,
        variationId: input.variationId,
        pagePath: input.pagePath,
        questionId: input.questionId,
        ipAddress: ipAddress as string,
        userAgent,
      });
      
      return { success: true };
    }),
  
  /**
   * Get experiment results (admin only)
   */
  getResults: protectedProcedure
    .input(z.object({
      experimentKey: z.string(),
    }))
    .query(async ({ input }) => {
      return await db.getExperimentResults(input.experimentKey);
    }),
  
  /**
   * List all experiments (admin only)
   */
  list: protectedProcedure
    .query(async () => {
      return await db.listExperiments();
    }),
  
  /**
   * Create a new experiment (admin only)
   */
  create: protectedProcedure
    .input(z.object({
      key: z.string(),
      name: z.string(),
      description: z.string().optional(),
      variations: z.array(z.object({
        id: z.string(),
        name: z.string(),
        value: z.any(),
      })),
      weights: z.array(z.number()).optional(),
      coverage: z.number().min(0).max(100).default(100),
      pagePath: z.string().optional(),
      questionId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new Error('Database not available');
      
      await database.insert(experiments).values({
        key: input.key,
        name: input.name,
        description: input.description,
        variations: JSON.stringify(input.variations),
        weights: input.weights ? JSON.stringify(input.weights) : null,
        coverage: input.coverage,
        pagePath: input.pagePath,
        questionId: input.questionId,
        isActive: true,
      });
      
      return { success: true };
    }),
});