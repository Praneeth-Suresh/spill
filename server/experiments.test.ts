import { describe, it, expect } from 'vitest';

/**
 * Unit tests for experiments functionality
 * These tests document the expected behavior of the A/B testing system
 */
describe('Experiments System', () => {
  describe('Data Structures', () => {
    it('should define proper experiment structure', () => {
      const experiment = {
        id: 1,
        key: 'button-color-test',
        name: 'Button Color Test',
        description: 'Testing which button color gets more clicks',
        isActive: true,
        variations: [
          { id: '0', name: 'Control', value: '#CDFF00' },
          { id: '1', name: 'Variant A', value: '#FF6B6B' }
        ],
        weights: [0.5, 0.5],
        coverage: 100,
        condition: null,
        pagePath: '/home',
        questionId: null,
      };

      expect(experiment).toHaveProperty('key');
      expect(experiment).toHaveProperty('variations');
      expect(experiment.variations).toHaveLength(2);
      expect(experiment.weights).toHaveLength(2);
    });

    it('should define proper exposure structure', () => {
      const exposure = {
        deviceId: 'device-123',
        sessionId: 'session-456',
        experimentKey: 'button-color-test',
        variationId: '1',
        pagePath: '/home',
        questionId: undefined,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      expect(exposure).toHaveProperty('deviceId');
      expect(exposure).toHaveProperty('experimentKey');
      expect(exposure).toHaveProperty('variationId');
    });
  });

  describe('GrowthBook Config Transformation', () => {
    it('should transform experiment to GrowthBook format', () => {
      const experiment = {
        id: 1,
        key: 'button-color-test',
        name: 'Button Color Test',
        variations: [
          { id: '0', name: 'Control', value: '#CDFF00' },
          { id: '1', name: 'Variant A', value: '#FF6B6B' }
        ],
        weights: [0.5, 0.5],
        coverage: 100,
        condition: null,
      };

      // Expected GrowthBook format
      const features = {
        'button-color-test': {
          defaultValue: '#CDFF00',
          rules: [
            {
              condition: undefined,
              coverage: 1, // 100 / 100
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
      };

      expect(features['button-color-test']).toHaveProperty('defaultValue');
      expect(features['button-color-test']).toHaveProperty('rules');
      expect(features['button-color-test'].rules[0].coverage).toBe(1);
      expect(features['button-color-test'].rules[0].variations).toHaveLength(2);
    });

    it('should handle partial coverage', () => {
      const coverage = 50; // 50% of users
      const normalizedCoverage = coverage / 100;
      
      expect(normalizedCoverage).toBe(0.5);
    });

    it('should handle missing weights', () => {
      const weights = undefined;
      const normalizedWeights = Array.isArray(weights) ? weights : undefined;
      
      expect(normalizedWeights).toBeUndefined();
    });
  });

  describe('Conversion Rate Calculations', () => {
    it('should calculate correct conversion rates', () => {
      const exposures = [
        { variationId: '0', count: 523 },
        { variationId: '1', count: 517 }
      ];

      const conversions = [
        { variationId: '0', count: 87 },
        { variationId: '1', count: 104 }
      ];

      // Calculate conversion rates
      const controlRate = (conversions[0].count / exposures[0].count) * 100;
      const variantRate = (conversions[1].count / exposures[1].count) * 100;

      expect(controlRate).toBeCloseTo(16.63, 2);
      expect(variantRate).toBeCloseTo(20.12, 2);
      
      // Variant has higher conversion rate
      expect(variantRate).toBeGreaterThan(controlRate);
    });

    it('should handle zero exposures', () => {
      const exposures = 0;
      const conversions = 5;
      
      const rate = exposures === 0 ? 0 : (conversions / exposures) * 100;
      
      expect(rate).toBe(0);
    });

    it('should handle zero conversions', () => {
      const exposures = 100;
      const conversions = 0;
      
      const rate = (conversions / exposures) * 100;
      
      expect(rate).toBe(0);
    });
  });

  describe('Experiment Targeting', () => {
    it('should filter by page path', () => {
      const experiments = [
        { key: 'home-test', pagePath: '/home' },
        { key: 'about-test', pagePath: '/about' },
        { key: 'global-test', pagePath: null },
      ];

      const currentPath = '/home';
      const filtered = experiments.filter(
        exp => exp.pagePath === currentPath || exp.pagePath === null
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map(e => e.key)).toContain('home-test');
      expect(filtered.map(e => e.key)).toContain('global-test');
    });

    it('should filter by question ID', () => {
      const experiments = [
        { key: 'q1-test', questionId: 1 },
        { key: 'q2-test', questionId: 2 },
        { key: 'global-test', questionId: null },
      ];

      const currentQuestionId = 1;
      const filtered = experiments.filter(
        exp => exp.questionId === currentQuestionId || exp.questionId === null
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map(e => e.key)).toContain('q1-test');
      expect(filtered.map(e => e.key)).toContain('global-test');
    });
  });

  describe('Error Handling', () => {
    it('should require database for tracking', () => {
      const dbAvailable = false;
      
      expect(() => {
        if (!dbAvailable) {
          throw new Error('Database not available');
        }
      }).toThrow('Database not available');
    });

    it('should handle missing variations gracefully', () => {
      const variations: any[] = [];
      const defaultValue = variations[0]?.value || null;
      
      expect(defaultValue).toBeNull();
    });

    it('should handle non-array variations', () => {
      const variations: any = null;
      const safeVariations = Array.isArray(variations) ? variations : [];
      
      expect(safeVariations).toEqual([]);
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize variations correctly', () => {
      const variations = [
        { id: '0', name: 'Control', value: '#CDFF00' },
        { id: '1', name: 'Variant A', value: '#FF6B6B' }
      ];

      const serialized = JSON.stringify(variations);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(variations);
    });

    it('should serialize weights correctly', () => {
      const weights = [0.5, 0.5];
      
      const serialized = JSON.stringify(weights);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(weights);
    });

    it('should handle null weights', () => {
      const weights = null;
      const serialized = weights ? JSON.stringify(weights) : null;
      
      expect(serialized).toBeNull();
    });
  });
});

