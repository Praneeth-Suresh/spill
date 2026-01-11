import { describe, it, expect, beforeEach, vi } from 'vitest';
import { experimentsRouter } from './routers/experiments';
import type { TrpcContext } from './_core/context';

// Mock the db module
vi.mock('./db', () => ({
  getDb: vi.fn(),
  getGrowthBookConfig: vi.fn(),
  trackExposure: vi.fn(),
  getExperimentResults: vi.fn(),
}));

vi.mock('../drizzle/schema', () => ({
  experiments: {
    insert: vi.fn(),
  },
}));

describe('Experiments Router', () => {
  let mockContext: Partial<TrpcContext>;

  beforeEach(() => {
    mockContext = {
      req: {
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      } as any,
      res: {} as any,
      user: {
        id: 1,
        openId: 'test-user',
        name: 'Test User',
        role: 'admin',
        points: 0,
      } as any,
    };

    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return GrowthBook config', async () => {
      const { getGrowthBookConfig } = await import('./db');
      
      const mockConfig = {
        features: {
          'button-color-test': {
            defaultValue: '#CDFF00',
            rules: [],
          },
        },
      };

      vi.mocked(getGrowthBookConfig).mockResolvedValue(mockConfig);

      const caller = experimentsRouter.createCaller(mockContext as any);
      const result = await caller.getConfig({ pagePath: '/home' });

      expect(result).toEqual(mockConfig);
      expect(getGrowthBookConfig).toHaveBeenCalledWith('/home', undefined);
    });

    it('should handle optional parameters', async () => {
      const { getGrowthBookConfig } = await import('./db');
      
      vi.mocked(getGrowthBookConfig).mockResolvedValue({ features: {} });

      const caller = experimentsRouter.createCaller(mockContext as any);
      await caller.getConfig({});

      expect(getGrowthBookConfig).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('trackExposure', () => {
    it('should track exposure with correct data', async () => {
      const { trackExposure } = await import('./db');
      
      vi.mocked(trackExposure).mockResolvedValue(undefined);

      const caller = experimentsRouter.createCaller(mockContext as any);
      const result = await caller.trackExposure({
        deviceId: 'device-123',
        sessionId: 'session-456',
        experimentKey: 'button-color-test',
        variationId: '1',
        pagePath: '/home',
      });

      expect(result).toEqual({ success: true });
      expect(trackExposure).toHaveBeenCalledWith({
        deviceId: 'device-123',
        sessionId: 'session-456',
        experimentKey: 'button-color-test',
        variationId: '1',
        pagePath: '/home',
        questionId: undefined,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });
    });

    it('should handle missing IP address', async () => {
      const { trackExposure } = await import('./db');
      
      const contextWithoutIp = {
        ...mockContext,
        req: {
          headers: {
            'user-agent': 'Mozilla/5.0',
          },
        } as any,
      };

      vi.mocked(trackExposure).mockResolvedValue(undefined);

      const caller = experimentsRouter.createCaller(contextWithoutIp as any);
      await caller.trackExposure({
        deviceId: 'device-123',
        sessionId: 'session-456',
        experimentKey: 'test',
        variationId: '0',
      });

      expect(trackExposure).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: 'unknown',
        })
      );
    });

    it('should handle x-forwarded-for header', async () => {
      const { trackExposure } = await import('./db');
      
      const contextWithForwardedFor = {
        ...mockContext,
        req: {
          ip: undefined,
          headers: {
            'x-forwarded-for': '203.0.113.1',
            'user-agent': 'Mozilla/5.0',
          },
        } as any,
      };

      vi.mocked(trackExposure).mockResolvedValue(undefined);

      const caller = experimentsRouter.createCaller(contextWithForwardedFor as any);
      await caller.trackExposure({
        deviceId: 'device-123',
        sessionId: 'session-456',
        experimentKey: 'test',
        variationId: '0',
      });

      expect(trackExposure).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '203.0.113.1',
        })
      );
    });
  });

  describe('getResults', () => {
    it('should return experiment results for admin', async () => {
      const { getExperimentResults } = await import('./db');
      
      const mockResults = {
        exposures: [
          { variationId: '0', count: 100 },
          { variationId: '1', count: 98 },
        ],
        conversions: [
          { variationId: '0', count: 25 },
          { variationId: '1', count: 32 },
        ],
      };

      vi.mocked(getExperimentResults).mockResolvedValue(mockResults);

      const caller = experimentsRouter.createCaller(mockContext as any);
      const result = await caller.getResults({ experimentKey: 'button-color-test' });

      expect(result).toEqual(mockResults);
      expect(getExperimentResults).toHaveBeenCalledWith('button-color-test');
    });

    it('should require authentication', async () => {
      const contextWithoutUser = {
        ...mockContext,
        user: null,
      };

      const caller = experimentsRouter.createCaller(contextWithoutUser as any);

      await expect(
        caller.getResults({ experimentKey: 'test' })
      ).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('should create experiment with valid data', async () => {
      const { getDb } = await import('./db');
      
      const mockDb = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const caller = experimentsRouter.createCaller(mockContext as any);
      const result = await caller.create({
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
      });

      expect(result).toEqual({ success: true });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'button-color-test',
          name: 'Button Color Test',
          isActive: true,
        })
      );
    });

    it('should serialize JSON fields correctly', async () => {
      const { getDb } = await import('./db');
      
      const mockDb = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const caller = experimentsRouter.createCaller(mockContext as any);
      await caller.create({
        key: 'test',
        name: 'Test',
        variations: [{ id: '0', name: 'Control', value: 'A' }],
        weights: [1.0],
        coverage: 100,
      });

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          variations: JSON.stringify([{ id: '0', name: 'Control', value: 'A' }]),
          weights: JSON.stringify([1.0]),
        })
      );
    });

    it('should handle optional fields', async () => {
      const { getDb } = await import('./db');
      
      const mockDb = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const caller = experimentsRouter.createCaller(mockContext as any);
      await caller.create({
        key: 'test',
        name: 'Test',
        variations: [{ id: '0', name: 'Control', value: 'A' }],
        coverage: 50,
      });

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          description: undefined,
          weights: null,
          pagePath: undefined,
          questionId: undefined,
        })
      );
    });

    it('should throw error when database is unavailable', async () => {
      const { getDb } = await import('./db');
      
      vi.mocked(getDb).mockResolvedValue(null);

      const caller = experimentsRouter.createCaller(mockContext as any);

      await expect(
        caller.create({
          key: 'test',
          name: 'Test',
          variations: [{ id: '0', name: 'Control', value: 'A' }],
          coverage: 100,
        })
      ).rejects.toThrow('Database not available');
    });

    it('should require authentication', async () => {
      const contextWithoutUser = {
        ...mockContext,
        user: null,
      };

      const caller = experimentsRouter.createCaller(contextWithoutUser as any);

      await expect(
        caller.create({
          key: 'test',
          name: 'Test',
          variations: [],
          coverage: 100,
        })
      ).rejects.toThrow();
    });
  });
});
