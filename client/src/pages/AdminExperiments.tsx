import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminExperiments() {
  const [experimentKey, setExperimentKey] = useState('');
  const [experimentName, setExperimentName] = useState('');
  const [variations, setVariations] = useState([
    { id: '0', name: 'Control', value: '#CDFF00' },
    { id: '1', name: 'Variant A', value: '#FF6B6B' },
  ]);
  
  const createExperiment = trpc.experiments.create.useMutation();
  
  const handleCreate = async () => {
    await createExperiment.mutateAsync({
      key: experimentKey,
      name: experimentName,
      variations,
      weights: [0.5, 0.5], // 50/50 split
      coverage: 100, // Include 100% of users
    });
    
    alert('Experiment created!');
  };
  
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create A/B Test Experiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              placeholder="Experiment Key (e.g., button-color)"
              value={experimentKey}
              onChange={(e) => setExperimentKey(e.target.value)}
            />
            <Input
              placeholder="Experiment Name"
              value={experimentName}
              onChange={(e) => setExperimentName(e.target.value)}
            />
            
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
            </div>
            
            <Button onClick={handleCreate}>Create Experiment</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}