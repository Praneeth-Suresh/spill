import { useEffect, useState } from 'react';
import { GrowthBook } from '@growthbook/growthbook-react';
import { trpc } from '@/lib/trpc';

const getStoredId = (storage: Storage | null, key: string) => {
  if (!storage) return '';
  const existing = storage.getItem(key);
  if (existing) return existing;

  const generated = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  storage.setItem(key, generated);
  return generated;
};

// Persistent identifiers for tracking users across sessions
const DEVICE_ID = getStoredId(typeof window !== 'undefined' ? window.localStorage : null, 'device_id');
const SESSION_ID = getStoredId(typeof window !== 'undefined' ? window.sessionStorage : null, 'session_id');

// Create a singleton GrowthBook instance to avoid recreating it on every render
let gbInstance: GrowthBook | null = null;

/**
 * Hook to initialize and manage GrowthBook instance for A/B testing
 * 
 * @param pagePath - Optional page path to filter experiments by location
 * @param questionId - Optional question ID to filter experiments by question
 * @returns Object containing GrowthBook instance and loading state
 * 
 * @example
 * ```tsx
 * const { gb, loading } = useGrowthBook('/home', 123);
 * if (!loading && gb) {
 *   const buttonColor = gb.getFeatureValue('button-color', '#CDFF00');
 * }
 * ```
 */
export function useGrowthBook(pagePath?: string, questionId?: number) {
  const [gb, setGb] = useState<GrowthBook | null>(gbInstance);
  const [loading, setLoading] = useState(!gbInstance);
  
  const { data: config } = trpc.experiments.getConfig.useQuery({
    pagePath,
    questionId,
  });
  
  const trackExposure = trpc.experiments.trackExposure.useMutation();
  
  useEffect(() => {
    if (!config) return;
    
    if (!gbInstance) {
      // Initialize GrowthBook with your config
      gbInstance = new GrowthBook({
        attributes: {
          id: DEVICE_ID,
          deviceId: DEVICE_ID,
          sessionId: SESSION_ID,
          pagePath,
          questionId,
        },
        // This callback fires when a user is exposed to an experiment
        trackingCallback: (experiment, result) => {
          try {
            console.log('Experiment exposure:', {
              experimentKey: experiment.key,
              variationId: result.key,
            });
            
            // Send to your MySQL database
            trackExposure.mutate({
              deviceId: DEVICE_ID,
              sessionId: SESSION_ID,
              experimentKey: experiment.key,
              variationId: result.key,
              pagePath,
              questionId,
            });
          } catch (error) {
            console.error('Experiment tracking error:', error);
          }
        },
      });
      
      setGb(gbInstance);
    }
    
    // Load features from your config
    gbInstance.setFeatures(config.features);
    setLoading(false);
  }, [config, pagePath, questionId]);
  
  return { gb, loading };
}

/**
 * Hook to get a feature value with A/B testing
 * 
 * @param featureKey - The unique key identifying the feature/experiment
 * @param defaultValue - The default value to return if the feature is not found
 * @param pagePath - Optional page path to filter experiments
 * @param questionId - Optional question ID to filter experiments
 * @returns The feature value (either the default or the experiment variation)
 * 
 * @example
 * ```tsx
 * // Get button color from A/B test
 * const buttonColor = useFeature('button-color', '#CDFF00', '/home');
 * 
 * // Get text variant
 * const welcomeText = useFeature('welcome-message', 'Hello!', '/home');
 * ```
 */
export function useFeature<T = any>(featureKey: string, defaultValue: T, pagePath?: string, questionId?: number): T {
  const { gb, loading } = useGrowthBook(pagePath, questionId);
  const [value, setValue] = useState<T>(defaultValue);
  
  useEffect(() => {
    if (!gb || loading) return;
    
    try {
      const featureValue = gb.getFeatureValue(featureKey, defaultValue);
      setValue(featureValue as T);
    } catch (error) {
      console.error('GrowthBook feature evaluation error:', error);
      setValue(defaultValue);
    }
    
    // Listen for feature changes
    const unsubscribe = gb.subscribe(() => {
      const newValue = gb.getFeatureValue(featureKey, defaultValue);
      setValue(newValue as T);
    });
    
    return unsubscribe;
  }, [gb, loading, featureKey, defaultValue]);
  
  return value;
}