import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, LogOut } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";

/**
 * AdminDashboard displays aggregated feedback statistics and analytics.
 * Super admins see all facilities, regular admins see only assigned facilities.
 * Features data export functionality and real-time statistics.
 */
export default function AdminDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');

  const { data: facilities, isLoading: facilitiesLoading } = trpc.admin.getFacilities.useQuery(undefined, {
    enabled: !!user && (user.role === 'admin' || user.role === 'super_admin'),
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.admin.getFacilityStats.useQuery(
    { facilityId: selectedFacilityId!, timeRange },
    { enabled: !!selectedFacilityId }
  );

  const exportMutation = trpc.admin.exportResponses.useMutation({
    onSuccess: (data) => {
      // Create download link
      const blob = new Blob([data.data], { 
        type: data.format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spill-export-${Date.now()}.${data.format}`;
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

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (!selectedFacilityId) {
      toast.error("Please select a facility first");
      return;
    }

    exportMutation.mutate({
      facilityIds: [selectedFacilityId],
      format,
    });
  };

  // Redirect to login if not authenticated
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
            <CardDescription>Please log in to access the admin dashboard</CardDescription>
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

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You do not have permission to access this page</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Auto-select first facility if available
  if (facilities && facilities.length > 0 && !selectedFacilityId) {
    setSelectedFacilityId(facilities[0].id);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <a href="/" className="text-2xl font-bold hover:underline">spill.</a>
              <p className="text-sm text-muted-foreground">
                Welcome back, {user.name || 'Admin'}
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8">
        {/* Facility Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Facility</CardTitle>
            <CardDescription>
              {user.role === 'super_admin' 
                ? 'You have access to all facilities' 
                : 'Select from your assigned facilities'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Select
                value={selectedFacilityId?.toString()}
                onValueChange={(value) => setSelectedFacilityId(parseInt(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities?.map((facility) => (
                    <SelectItem key={facility.id} value={facility.id.toString()}>
                      {facility.name} ({facility.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        {selectedFacilityId && (
          <div className="space-y-6">
            {/* Overview Card */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {facilities?.find(f => f.id === selectedFacilityId)?.name} Overview
                </CardTitle>
                <CardDescription>
                  Feedback statistics for {timeRange === 'week' ? 'this week' : timeRange === 'month' ? 'this month' : 'all time'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin h-8 w-8" />
                  </div>
                ) : stats ? (
                  <div className="space-y-6">
                    {/* Total Feedback */}
                    <div className="text-center p-6 bg-primary/10 rounded-lg">
                      <div className="text-4xl font-bold mb-2">{stats.totalResponses}</div>
                      <div className="text-sm text-muted-foreground">
                        Total Feedback Received {timeRange === 'week' ? 'This Week' : timeRange === 'month' ? 'This Month' : ''}
                      </div>
                    </div>

                    {/* Top Problems */}
                    {stats.topProblems.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-4">
                          Top {stats.topProblems.length} Problems {timeRange === 'week' ? 'This Week' : timeRange === 'month' ? 'This Month' : ''}
                        </h3>
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
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No data available for this facility
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Export Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Export Data</CardTitle>
                <CardDescription>
                  Download feedback data for analysis and reporting
                </CardDescription>
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
                  <Button
                    onClick={() => refetchStats()}
                    variant="outline"
                  >
                    Refresh Data
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/results/2")}
                    className="justify-start"
                  >
                    View Movie Poll Results
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/results/3")}
                    className="justify-start"
                  >
                    View Equipment Reports
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/results/4")}
                    className="justify-start"
                  >
                    View Activity Suggestions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!selectedFacilityId && !facilitiesLoading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Please select a facility to view statistics
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
