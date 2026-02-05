import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocation } from 'wouter';

/**
 * Admin page for managing A/B test experiments
 * Allows creating new experiments and viewing results
 */
export default function AdminExperimentsPage() {
  const [, setLocation] = useLocation();
  const [experimentKey, setExperimentKey] = useState('');
  const [experimentName, setExperimentName] = useState('');
  const [variations, setVariations] = useState([
    { id: '0', name: 'Control', value: '#CDFF00' },
    { id: '1', name: 'Variant A', value: '#FF6B6B' },
  ]);
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(null);
  
  const createExperiment = trpc.experiments.create.useMutation();
  const listExperiments = trpc.experiments.list.useQuery();
  const { data: results, isLoading: resultsLoading } = trpc.experiments.getResults.useQuery(
    { experimentKey: selectedExperiment || '' },
    { enabled: !!selectedExperiment }
  );
  
  const handleCreate = async () => {
    if (!experimentKey || !experimentName) {
      alert('Please fill in experiment key and name');
      return;
    }
    
    try {
      await createExperiment.mutateAsync({
        key: experimentKey,
        name: experimentName,
        variations,
        weights: [0.5, 0.5],
        coverage: 100,
      });
      
      alert('Experiment created successfully!');
      setExperimentKey('');
      setExperimentName('');
      setVariations([
        { id: '0', name: 'Control', value: '#CDFF00' },
        { id: '1', name: 'Variant A', value: '#FF6B6B' },
      ]);
      
      // Refetch the list
      listExperiments.refetch();
    } catch (error: any) {
      alert(`Failed to create experiment: ${error.message}`);
    }
  };
  
  const calculateConversionRate = (variationId: string) => {
    if (!results) return 0;
    const exposure = results.exposures.find((e: any) => e.variationId === variationId);
    const conversion = results.conversions.find((c: any) => c.variationId === variationId);
    
    if (!exposure || exposure.count === 0) return 0;
    return ((conversion?.count || 0) / exposure.count) * 100;
  };
  
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">A/B Test Experiments</h1>
        <p className="text-gray-600">Create and manage experiments for A/B testing</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => setLocation('/admin')}
        >
          ← Back to Admin Dashboard
        </Button>
      </div>
      
      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create Experiment</TabsTrigger>
          <TabsTrigger value="results">View Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create A/B Test Experiment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Experiment Key (unique identifier)
                  </label>
                  <Input
                    placeholder="e.g., button-color-test"
                    value={experimentKey}
                    onChange={(e) => setExperimentKey(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Experiment Name
                  </label>
                  <Input
                    placeholder="e.g., Button Color A/B Test"
                    value={experimentName}
                    onChange={(e) => setExperimentName(e.target.value)}
                  />
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Variations</h3>
                  {variations.map((v, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <Input
                        placeholder="Variation Name"
                        value={v.name}
                        onChange={(e) => {
                          const newVariations = [...variations];
                          newVariations[i].name = e.target.value;
                          setVariations(newVariations);
                        }}
                      />
                      <Input
                        placeholder="Value (e.g., #FF0000)"
                        value={v.value}
                        onChange={(e) => {
                          const newVariations = [...variations];
                          newVariations[i].value = e.target.value;
                          setVariations(newVariations);
                        }}
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setVariations([
                        ...variations,
                        { id: String(variations.length), name: `Variant ${String.fromCharCode(65 + variations.length - 1)}`, value: '' }
                      ]);
                    }}
                  >
                    + Add Variation
                  </Button>
                </div>
                
                <Button 
                  onClick={handleCreate}
                  disabled={createExperiment.isPending}
                >
                  {createExperiment.isPending ? 'Creating...' : 'Create Experiment'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="results">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Select Experiment</CardTitle>
              </CardHeader>
              <CardContent>
                {listExperiments.isLoading ? (
                  <p>Loading experiments...</p>
                ) : listExperiments.data && listExperiments.data.length > 0 ? (
                  <div className="space-y-2">
                    {listExperiments.data.map((exp: any) => (
                      <Button
                        key={exp.key}
                        variant={selectedExperiment === exp.key ? 'default' : 'outline'}
                        className="w-full justify-start"
                        onClick={() => setSelectedExperiment(exp.key)}
                      >
                        <div className="text-left">
                          <div className="font-semibold">{exp.name}</div>
                          <div className="text-xs text-gray-500">{exp.key}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No experiments found</p>
                    <p className="text-sm text-gray-400">Create your first experiment in the "Create Experiment" tab</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {selectedExperiment && (
              <Card>
                <CardHeader>
                  <CardTitle>Experiment Results: {selectedExperiment}</CardTitle>
                </CardHeader>
                <CardContent>
                  {resultsLoading ? (
                    <p>Loading results...</p>
                  ) : results && results.exposures && results.exposures.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {results.exposures.map((exposure: any) => {
                        const conversionRate = calculateConversionRate(exposure.variationId);
                        const conversion = results.conversions.find((c: any) => c.variationId === exposure.variationId);
                        
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
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No exposure data yet for this experiment
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
