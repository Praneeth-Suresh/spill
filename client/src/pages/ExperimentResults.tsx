import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ExperimentResults({ experimentKey }: { experimentKey: string }) {
  const { data: results } = trpc.experiments.getResults.useQuery({ experimentKey });
  
  if (!results) return <div>Loading...</div>;
  
  const calculateConversionRate = (variationId: string) => {
    const exposure = results.exposures.find(e => e.variationId === variationId);
    const conversion = results.conversions.find(c => c.variationId === variationId);
    
    if (!exposure || exposure.count === 0) return 0;
    return ((conversion?.count || 0) / exposure.count) * 100;
  };
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Experiment Results: {experimentKey}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.exposures.map((exposure) => {
          const conversionRate = calculateConversionRate(exposure.variationId);
          const conversion = results.conversions.find(c => c.variationId === exposure.variationId);
          
          return (
            <Card key={exposure.variationId}>
              <CardHeader>
                <CardTitle>Variation {exposure.variationId}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Exposures:</strong> {exposure.count}</p>
                  <p><strong>Conversions:</strong> {conversion?.count || 0}</p>
                  <p><strong>Conversion Rate:</strong> {conversionRate.toFixed(2)}%</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}