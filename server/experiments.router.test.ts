import { describe, it, expect, vi, beforeEach } from 'vitest';
import { experimentsRouter } from './routers/experiments';
import * as db from './db';
import { experiments } from '../drizzle/schema';

/**
 * API endpoint tests for experiments router
 * Tests tRPC procedures with proper database mocking
 */

// Mock database module
vi.mock('./db', () => ({
  getDb: vi.fn(),
  getGrowthBookConfig: vi.fn(),
  trackExposure: vi.fn(),
  getExperimentResults: vi.fn(),
  listExperiments: vi.fn(),
}));

// Mock drizzle schema
vi.mock('../drizzle/schema', () => ({
  experiments: {},
  experimentExposures: {},
}));

describe('Experiments Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig endpoint', () => {
    it('should return GrowthBook config for a given page', async () => {
      const mockConfig = {
        features: {
          'button-color-test': {
            defaultValue: '#CDFF00',
            rules: [
              {
                condition: undefined,
                coverage: 1,
                weights: [0.5, 0.5],
                variations: ['#CDFF00', '#FF6B6B'],
                key: 'button-color-test',
                meta: {
                  experimentId: 1,
                  experimentName: 'Button Color Test',
                },
              },
            ],
          },
        },
      };

      vi.mocked(db.getGrowthBookConfig).mockResolvedValue(mockConfig);

      const caller = experimentsRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: null,
      });

      const result = await caller.getConfig({ pagePath: '/home' });

      expect(db.getGrowthBookConfig).toHaveBeenCalledWith('/home', undefined);
      expect(result).toEqual(mockConfig);
      expect(result.features['button-color-test']).toBeDefined();
    });

    it('should return config for a specific question', async () => {
      const mockConfig = {
        features: {
          'question-layout-test': {
            defaultValue: 'vertical',
            rules: [
              {
                condition: undefined,
                coverage: 0.5,
                weights: [0.5, 0.5],
                variations: ['vertical', 'horizontal'],
                key: 'question-layout-test',
                meta: {
                  experimentId: 2,
                  experimentName: 'Question Layout Test',
                },
              },
            ],
          },
        },
      };

      vi.mocked(db.getGrowthBookConfig).mockResolvedValue(mockConfig);

      const caller = experimentsRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: null,
      });

      const result = await caller.getConfig({ questionId: 5 });

      expect(db.getGrowthBookConfig).toHaveBeenCalledWith(undefined, 5);
      expect(result.features['question-layout-test']).toBeDefined();
    });
  });

  describe('trackExposure endpoint', () => {
    it('should track user exposure to an experiment', async () => {
      vi.mocked(db.trackExposure).mockResolvedValue(undefined);

      const caller = experimentsRouter.createCaller({
        req: {
          ip: '192.168.1.1',
          headers: { 'user-agent': 'Mozilla/5.0' },
        } as any,
        res: {} as any,
        user: null,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      const result = await caller.trackExposure({
        deviceId: 'device-123',
        sessionId: 'session-456',
        experimentKey: 'button-color-test',
        variationId: '1',
        pagePath: '/home',
      });

      expect(db.trackExposure).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceId: 'device-123',
          sessionId: 'session-456',
          experimentKey: 'button-color-test',
          variationId: '1',
          pagePath: '/home',
          questionId: undefined,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle missing IP and user agent', async () => {
      vi.mocked(db.trackExposure).mockResolvedValue(undefined);

      const caller = experimentsRouter.createCaller({
        req: {
          headers: {},
        } as any,
        res: {} as any,
        user: null,
      });

      const result = await caller.trackExposure({
        deviceId: 'device-123',
        sessionId: 'session-456',
        experimentKey: 'button-color-test',
        variationId: '1',
      });

      expect(db.trackExposure).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: 'unknown',
          userAgent: '',
        })
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getResults endpoint (protected)', () => {
    it('should return experiment results for admin users', async () => {
      const mockResults = {
        exposures: [
          { variationId: '0', count: 100 },
          { variationId: '1', count: 95 },
        ],
        conversions: [
          { variationId: '0', count: 10 },
          { variationId: '1', count: 15 },
        ],
      };

      vi.mocked(db.getExperimentResults).mockResolvedValue(mockResults);

      const caller = experimentsRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@example.com' },
      });

      const result = await caller.getResults({ experimentKey: 'button-color-test' });

      expect(db.getExperimentResults).toHaveBeenCalledWith('button-color-test');
      expect(result.exposures).toHaveLength(2);
      expect(result.conversions).toHaveLength(2);
    });

    it('should deny access to non-admin users', async () => {
      const caller = experimentsRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: null,
      });

      await expect(caller.getResults({ experimentKey: 'button-color-test' }))
        .rejects
        .toThrow();
    });
  });

  describe('list endpoint (protected)', () => {
    it('should return all experiments for admin users', async () => {
      const mockExperiments = [
        {
          key: 'experiment-2',
          name: 'Experiment 2',
          description: 'Second experiment',
          isActive: true,
          createdAt: new Date('2024-01-02'),
        },
        {
          key: 'experiment-1',
          name: 'Experiment 1',
          description: 'First experiment',
          isActive: true,
          createdAt: new Date('2024-01-01'),
        },
      ];

      vi.mocked(db.listExperiments).mockResolvedValue(mockExperiments);

      const caller = experimentsRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@example.com' },
      });

      const result = await caller.list();

      expect(db.listExperiments).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('experiment-2');
    });

    it('should deny access to non-admin users', async () => {
      const caller = experimentsRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: null,
      });

      await expect(caller.list()).rejects.toThrow();
    });
  });

  describe('create endpoint (protected)', () => {
    it('should create a new experiment for admin users', async () => {
      const mockDb = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(db.getDb).mockResolvedValue(mockDb as any);

      const caller = experimentsRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@example.com' },
      });

      const experimentInput = {
        key: 'button-color-test',
        name: 'Button Color Test',
        description: 'Testing button colors',
        variations: [
          { id: '0', name: 'Control', value: '#CDFF00' },
          { id: '1', name: 'Variant A', value: '#FF6B6B' },
        ],
        weights: [0.5, 0.5],
        coverage: 100,
        pagePath: '/home',
      };

      const result = await caller.create(experimentInput);

      expect(db.getDb).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledWith(experiments);
      expect(mockDb.values).toHaveBeenCalledWith({
        key: 'button-color-test',
        name: 'Button Color Test',
        description: 'Testing button colors',
        variations: experimentInput.variations,
        weights: [0.5, 0.5],
        coverage: 100,
        pagePath: '/home',
        questionId: undefined,
        isActive: true,
      });
      expect(result).toEqual({ success: true });
    });

    it('should handle missing database connection', async () => {
      vi.mocked(db.getDb).mockResolvedValue(null);

      const caller = experimentsRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@example.com' },
      });

      await expect(caller.create({
        key: 'test',
        name: 'Test',
        variations: [{ id: '0', name: 'Control', value: 'test' }],
      })).rejects.toThrow('Database not available');
    });

    it('should deny access to non-admin users', async () => {
      const caller = experimentsRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: null,
      });

      await expect(caller.create({
        key: 'test',
        name: 'Test',
        variations: [{ id: '0', name: 'Control', value: 'test' }],
      })).rejects.toThrow();
    });
  });

  describe('Input validation', () => {
    it('should accept valid experimentKey input', async () => {
      const mockResults = {
        exposures: [
          { variationId: '0', count: 100 },
          { variationId: '1', count: 95 },
        ],
        conversions: [
          { variationId: '0', count: 10 },
          { variationId: '1', count: 15 },
        ],
      };

      vi.mocked(db.getExperimentResults).mockResolvedValue(mockResults);

      const caller = experimentsRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@example.com' },
      });

      const result = await caller.getResults({ experimentKey: 'valid-key' });
      expect(result).toEqual(mockResults);
    });

    it('should validate coverage range', async () => {
      const mockDb = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(db.getDb).mockResolvedValue(mockDb as any);

      const caller = experimentsRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: { id: 1, role: 'admin', name: 'Admin', email: 'admin@example.com' },
      });

      await expect(caller.create({
        key: 'test',
        name: 'Test',
        variations: [{ id: '0', name: 'Control', value: 'test' }],
        coverage: 150, // Invalid: > 100
      })).rejects.toThrow();

      await expect(caller.create({
        key: 'test',
        name: 'Test',
        variations: [{ id: '0', name: 'Control', value: 'test' }],
        coverage: -10, // Invalid: < 0
      })).rejects.toThrow();
    });
  });
});
