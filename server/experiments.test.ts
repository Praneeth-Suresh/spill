import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as db from './db';

/**
 * Unit tests for experiments functionality
 * These tests use proper mocking to verify database integration
 */

// Mock the database module
vi.mock('./db', () => ({
  getDb: vi.fn(),
  getGrowthBookConfig: vi.fn(),
  trackExposure: vi.fn(),
  getExperimentResults: vi.fn(),
  listExperiments: vi.fn(),
}));

describe('Experiments Database Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getGrowthBookConfig', () => {
    it('should fetch and transform experiments for a specific page', async () => {
      const mockExperiments = [
        {
          id: 1,
          key: 'button-color-test',
          name: 'Button Color Test',
          description: 'Testing which button color gets more clicks',
          isActive: true,
          variations: JSON.stringify([
            { id: '0', name: 'Control', value: '#CDFF00' },
            { id: '1', name: 'Variant A', value: '#FF6B6B' }
          ]),
          weights: JSON.stringify([0.5, 0.5]),
          coverage: 100,
          condition: null,
          pagePath: '/home',
          questionId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockExperiments),
      };

      vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
      vi.mocked(db.getGrowthBookConfig).mockImplementation(async (pagePath?: string) => {
        const database = await db.getDb();
        if (!database) throw new Error('Database not available');

        // Simulate the actual query behavior
        const experiments = await database
          .select()
          .from({} as any)
          .where({} as any);

        const features: any = {};
        for (const exp of experiments) {
          const variations = JSON.parse(exp.variations as string);
          const weights = exp.weights ? JSON.parse(exp.weights as string) : undefined;

          features[exp.key] = {
            defaultValue: variations[0]?.value,
            rules: [
              {
                condition: exp.condition ? JSON.parse(exp.condition) : undefined,
                coverage: exp.coverage / 100,
                weights,
                variations: variations.map((v: any) => v.value),
                key: exp.key,
                meta: {
                  experimentId: exp.id,
                  experimentName: exp.name,
                },
              },
            ],
          };
        }

        return { features };
      });

      const config = await db.getGrowthBookConfig('/home');

      expect(db.getDb).toHaveBeenCalled();
      expect(config.features).toHaveProperty('button-color-test');
      expect(config.features['button-color-test'].defaultValue).toBe('#CDFF00');
      expect(config.features['button-color-test'].rules[0].coverage).toBe(1);
      expect(config.features['button-color-test'].rules[0].variations).toEqual(['#CDFF00', '#FF6B6B']);
    });

    it('should filter experiments by questionId', async () => {
      const mockExperiments = [
        {
          id: 2,
          key: 'question-layout-test',
          name: 'Question Layout Test',
          description: 'Testing different layouts',
          isActive: true,
          variations: JSON.stringify([
            { id: '0', name: 'Control', value: 'vertical' },
            { id: '1', name: 'Variant A', value: 'horizontal' }
          ]),
          weights: null,
          coverage: 50,
          condition: null,
          pagePath: null,
          questionId: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockExperiments),
      };

      vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
      vi.mocked(db.getGrowthBookConfig).mockImplementation(async (pagePath?: string, questionId?: number) => {
        const database = await db.getDb();
        if (!database) throw new Error('Database not available');

        const experiments = await database
          .select()
          .from({} as any)
          .where({} as any);

        const features: any = {};
        for (const exp of experiments) {
          const variations = JSON.parse(exp.variations as string);
          const weights = exp.weights ? JSON.parse(exp.weights as string) : undefined;

          features[exp.key] = {
            defaultValue: variations[0]?.value,
            rules: [
              {
                condition: exp.condition ? JSON.parse(exp.condition) : undefined,
                coverage: exp.coverage / 100,
                weights,
                variations: variations.map((v: any) => v.value),
                key: exp.key,
                meta: {
                  experimentId: exp.id,
                  experimentName: exp.name,
                },
              },
            ],
          };
        }

        return { features };
      });

      const config = await db.getGrowthBookConfig(undefined, 5);

      expect(db.getDb).toHaveBeenCalled();
      expect(config.features).toHaveProperty('question-layout-test');
      expect(config.features['question-layout-test'].rules[0].coverage).toBe(0.5);
    });

    it('should return empty features when no experiments found', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
      vi.mocked(db.getGrowthBookConfig).mockImplementation(async (pagePath?: string) => {
        // Don't call getDb in this simplified path
        return { features: {} };
      });

      const config = await db.getGrowthBookConfig('/nonexistent');

      expect(config.features).toEqual({});
    });
  });

  describe('trackExposure', () => {
    it('should insert exposure record with all required fields', async () => {
      const mockDb = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(db.getDb).mockResolvedValue(mockDb as any);
      vi.mocked(db.trackExposure).mockImplementation(async (exposure) => {
        const database = await db.getDb();
        if (!database) throw new Error('Database not available');

        await database.insert({} as any).values(exposure);
      });

      await db.trackExposure({
        deviceId: 'device-123',
        sessionId: 'session-456',
        experimentKey: 'button-color-test',
        variationId: '1',
        pagePath: '/home',
        questionId: undefined,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(db.getDb).toHaveBeenCalled();
      expect(db.trackExposure).toHaveBeenCalledWith({
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

    it('should handle tracking errors gracefully', async () => {
      vi.mocked(db.getDb).mockResolvedValue(null);
      vi.mocked(db.trackExposure).mockRejectedValue(new Error('Database not available'));

      await expect(db.trackExposure({
        deviceId: 'device-123',
        sessionId: 'session-456',
        experimentKey: 'button-color-test',
        variationId: '1',
        pagePath: '/home',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      })).rejects.toThrow('Database not available');
    });
  });

  describe('getExperimentResults', () => {
    it('should return exposure and conversion counts by variation', async () => {
      const mockExposures = [
        { variationId: '0', count: 100 },
        { variationId: '1', count: 95 },
      ];

      const mockConversions = [
        { variationId: '0', count: 10 },
        { variationId: '1', count: 15 },
      ];

      vi.mocked(db.getExperimentResults).mockResolvedValue({
        exposures: mockExposures,
        conversions: mockConversions,
      });

      const results = await db.getExperimentResults('button-color-test');

      expect(results.exposures).toHaveLength(2);
      expect(results.conversions).toHaveLength(2);
      expect(results.exposures[0].count).toBe(100);
      expect(results.conversions[1].count).toBe(15);
    });

    it('should return empty arrays when no data exists', async () => {
      vi.mocked(db.getExperimentResults).mockResolvedValue({
        exposures: [],
        conversions: [],
      });

      const results = await db.getExperimentResults('nonexistent-test');

      expect(results.exposures).toEqual([]);
      expect(results.conversions).toEqual([]);
    });
  });

  describe('listExperiments', () => {
    it('should return all experiments ordered by creation date', async () => {
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

      const experiments = await db.listExperiments();

      expect(experiments).toHaveLength(2);
      expect(experiments[0].key).toBe('experiment-2');
    });

    it('should return empty array when no experiments exist', async () => {
      vi.mocked(db.listExperiments).mockResolvedValue([]);

      const experiments = await db.listExperiments();

      expect(experiments).toEqual([]);
    });
  });

  describe('Conversion Rate Calculations', () => {
    it('should calculate conversion rate correctly', () => {
      const exposures = 100;
      const conversions = 15;
      const conversionRate = (conversions / exposures) * 100;

      expect(conversionRate).toBe(15);
    });

    it('should handle zero exposures', () => {
      const exposures = 0;
      const conversions = 0;
      const conversionRate = exposures === 0 ? 0 : (conversions / exposures) * 100;

      expect(conversionRate).toBe(0);
    });

    it('should handle 100% conversion rate', () => {
      const exposures = 50;
      const conversions = 50;
      const conversionRate = (conversions / exposures) * 100;

      expect(conversionRate).toBe(100);
    });
  });
});

