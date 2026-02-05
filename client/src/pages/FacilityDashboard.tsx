import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

/**
 * FacilityDashboard displays detailed analytics for a specific facility.
 * Shows question-specific statistics, recent responses, and export options.
 * Accessible to admins assigned to the facility and super admins.
 */
export default function FacilityDashboard() {
  const [, params] = useRoute("/facility/:code");
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const facilityCode = params?.code;

  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');

  const { data: facilities } = trpc.admin.getFacilities.useQuery(undefined, {
    enabled: !!user && (user.role === 'admin' || user.role === 'super_admin'),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const facility = facilities?.find(f => f.code.toLowerCase() === facilityCode?.toLowerCase());

  const {
    data: snapshot,
    isLoading: snapshotLoading,
    refetch: refetchSnapshot,
  } = trpc.admin.getFacilitySnapshot.useQuery(
    { facilityId: facility?.id!, timeRange },
    {
      enabled: !!facility,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      keepPreviousData: true,
    }
  );

  const stats = snapshot?.stats;
  const questions = (snapshot?.questions ?? []).filter(q => q.isActive);

  const exportMutation = trpc.admin.exportResponses.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.data], { 
        type: data.format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${facilityCode}-export-${Date.now()}.${data.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Export downloaded successfully");
    },
    onError: (error) => {
      toast.error(`Export failed: ${error.message}`);
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Login Required</CardTitle>
            <CardDescription>Please log in to access facility dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = getLoginUrl()} className="w-full">
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Facility Not Found</CardTitle>
            <CardDescription>The requested facility does not exist or you don't have access</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/admin")} className="w-full">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleExport = (format: 'csv' | 'json') => {
    exportMutation.mutate({
      facilityIds: [facility.id],
      format,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
                <a href="/" className="text-2xl font-bold hover:underline">spill.</a>
              <p className="text-sm text-muted-foreground">{facility.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8 space-y-6">
        {snapshotLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin h-6 w-6" />
          </div>
        )}
        {/* Overview Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Feedback</CardTitle>
                <CardDescription>
                  {timeRange === 'week' ? 'This week' : timeRange === 'month' ? 'This month' : 'All time'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{stats.totalResponses}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Questions</CardTitle>
                <CardDescription>Currently collecting feedback</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{questions?.length || 0}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Top Problems */}
        {stats && stats.topProblems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Issues Reported</CardTitle>
              <CardDescription>Most frequently reported problems</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topProblems.map((problem, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{problem.problem}</p>
                      <p className="text-sm text-muted-foreground">{problem.count} reports</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Questions List */}
        {questions && questions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Active Questions</CardTitle>
              <CardDescription>View detailed results for each question</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {questions.map((question) => (
                  <div key={question.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{question.title}</p>
                      <p className="text-sm text-muted-foreground capitalize">{question.type}</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setLocation(`/results/${question.id}`)}
                    >
                      View Results
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Export Data</CardTitle>
            <CardDescription>Download all feedback data for this facility</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                onClick={() => handleExport('csv')}
                disabled={exportMutation.isPending}
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Export as CSV
              </Button>
              <Button
                onClick={() => handleExport('json')}
                disabled={exportMutation.isPending}
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Export as JSON
              </Button>
              <Button onClick={() => refetchSnapshot()} variant="outline">
                Refresh Data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
