import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Download, LogOut, Maximize2, ImageDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { QRCodeCanvas } from "qrcode.react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type FacilitySnapshot = inferRouterOutputs<AppRouter>["admin"]["getFacilitySnapshot"];
type FacilityQuestion = FacilitySnapshot["questions"][number];

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
  const [visibleQuestionCount, setVisibleQuestionCount] = useState(10);
  const [qrPreviewQuestion, setQrPreviewQuestion] = useState<FacilityQuestion | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrReady, setQrReady] = useState(false);
  const [qrDownloadUrl, setQrDownloadUrl] = useState<string | null>(null);

  const domain = (import.meta.env.VITE_DOMAIN as string | undefined)?.replace(/\/$/, "") || window.location.origin;
  const buildResultsUrl = (questionId: number) => `${domain}/results/${questionId}`;

  const { data: facilities, isLoading: facilitiesLoading } = trpc.admin.getFacilities.useQuery(undefined, {
    enabled: !!user && (user.role === 'admin' || user.role === 'super_admin'),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const {
    data: snapshot,
    isLoading: snapshotLoading,
    isFetching: snapshotFetching,
    refetch: refetchSnapshot,
  } = trpc.admin.getFacilitySnapshot.useQuery(
    { facilityId: selectedFacilityId!, timeRange },
    {
      enabled: !!selectedFacilityId,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      keepPreviousData: true,
    }
  );

  const stats = snapshot?.stats;
  const facilityQuestions = snapshot?.questions ?? [];

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

  const handleOpenQr = (question: FacilityQuestion) => {
    setQrPreviewQuestion(question);
    setIsQrModalOpen(true);
  };

  const handleDownloadQr = () => {
    const dataUrl = qrDownloadUrl || qrCanvasRef.current?.toDataURL("image/png");
    if (!dataUrl || !qrPreviewQuestion) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `spill_${qrPreviewQuestion.id}_QR.png`;
    link.click();
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

  // Auto-select first facility if available
  useEffect(() => {
    if (facilities && facilities.length > 0 && !selectedFacilityId) {
      setSelectedFacilityId(facilities[0].id);
    }
  }, [facilities, selectedFacilityId]);

  // Reset question list and modal when facility changes
  useEffect(() => {
    setVisibleQuestionCount(10);
    setQrPreviewQuestion(null);
    setIsQrModalOpen(false);
  }, [selectedFacilityId]);

  // Prepare QR download once the modal canvas is ready
  useEffect(() => {
    if (!isQrModalOpen || !qrPreviewQuestion) {
      setQrReady(false);
      setQrDownloadUrl(null);
      return;
    }

    const frame = requestAnimationFrame(() => {
      const canvas = qrCanvasRef.current;
      if (canvas) {
        setQrReady(true);
        setQrDownloadUrl(canvas.toDataURL("image/png"));
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [isQrModalOpen, qrPreviewQuestion]);

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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLocation("/admin/experiments")}>
                A/B Experiments
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8 max-w-6xl">
        {/* Facility Selector */}
        <Card className="mb-6">
          <CardHeader className="gap-2 md:flex md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl">Select Facility</CardTitle>
              <CardDescription>
                {user.role === 'super_admin'
                  ? 'You have access to all facilities'
                  : 'Select from your assigned facilities'}
              </CardDescription>
            </div>
            <div className="text-sm text-muted-foreground">
              {facilitiesLoading ? 'Loading facilities…' : `${facilities?.length ?? 0} available`}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-[1.5fr,1fr]">
              <div>
                {/* Prominent selected facility display */}
                {selectedFacilityId && (
                  <div className="mb-2">
                    <span className="text-5xl font-bold">
                      {facilities?.find(f => f.id === selectedFacilityId)?.name}
                    </span>
                    <span className="ml-2 text-xl font-semibold text-muted-foreground">
                      ({facilities?.find(f => f.id === selectedFacilityId)?.code})
                    </span>
                  </div>
                )}
                <Select
                  value={selectedFacilityId?.toString()}
                  onValueChange={(value) => setSelectedFacilityId(parseInt(value))}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Choose a facility" />
                  </SelectTrigger>
                  <SelectContent>
                    {facilities?.map((facility) => (
                      <SelectItem key={facility.id} value={facility.id.toString()}>
                        {facility.name} ({facility.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="h-12" onClick={() => refetchSnapshot()}>
                  Refresh Stats
                </Button>
              </div>
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
                {(snapshotLoading && !stats) ? (
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

            {/* Questions slider */}
            <Card>
              <CardHeader>
                <CardTitle>Questions</CardTitle>
                <CardDescription>
                  Swipe across to see questions for this facility. Inactive questions are grayed out.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(snapshotLoading || snapshotFetching) && (
                  <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className="w-64 flex-shrink-0 rounded-xl border bg-muted/40 animate-pulse h-[260px]" />
                    ))}
                  </div>
                )}

                {facilityQuestions && facilityQuestions.length > 0 && (
                  <div className="-mx-2 overflow-x-auto pb-2">
                    <div className="flex gap-4 px-2">
                      {facilityQuestions.slice(0, visibleQuestionCount).map((question, index) => (
                        <QuestionCard
                          key={question.id}
                          question={question}
                          index={index}
                          resultsUrl={buildResultsUrl(question.id)}
                          onViewResults={() => setLocation(`/results/${question.id}`)}
                          onOpenQr={() => handleOpenQr(question)}
                        />
                      ))}

                      {(facilityQuestions.length > visibleQuestionCount) && (
                        <Card className="flex w-48 flex-shrink-0 items-center justify-center border-dashed">
                          <CardContent className="flex w-full flex-col items-center justify-center gap-3 p-4">
                            <p className="text-center text-sm text-muted-foreground">Load 10 more questions</p>
                            <Button variant="outline" onClick={() => setVisibleQuestionCount((prev) => prev + 10)}>
                              Load more
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                )}

                {!snapshotLoading && facilityQuestions?.length === 0 && (
                  <div className="text-sm text-muted-foreground">No questions found for this facility.</div>
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
                    onClick={() => refetchSnapshot()}
                    variant="outline"
                  >
                    Refresh Data
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            {/* Later enable this feature only to be used by super admins */}
            {/* <Card>
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
            </Card> */}
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

      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Question QR</DialogTitle>
            <DialogDescription>
              Scan or download the QR to open the results page.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-lg border p-4">
              {qrPreviewQuestion ? (
                qrReady ? (
                  <QRCodeCanvas
                    ref={qrCanvasRef}
                    value={buildResultsUrl(qrPreviewQuestion.id)}
                    size={260}
                    includeMargin
                  />
                ) : (
                  <div className="h-[260px] w-[260px] rounded-md bg-muted" />
                )
              ) : (
                <div className="h-[260px] w-[260px] rounded-md bg-muted" />
              )}
            </div>

            <div className="flex w-full items-center justify-between">
              <div>
                <p className="font-medium">spill_{qrPreviewQuestion?.id ?? ""}_QR.png</p>
                <p className="text-sm text-muted-foreground">PNG download</p>
              </div>
              <Button onClick={handleDownloadQr} disabled={!qrPreviewQuestion || !qrReady}>
                <ImageDown className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  resultsUrl,
  onViewResults,
  onOpenQr,
}: {
  question: FacilityQuestion;
  index: number;
  resultsUrl: string;
  onViewResults: () => void;
  onOpenQr: () => void;
}) {
  const [qrReady, setQrReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setQrReady(true));
    return () => cancelAnimationFrame(frame);
  }, [resultsUrl]);

  const questionNumber = index + 1;
  const inactive = !question.isActive;

  return (
    <Card className={`w-64 flex-shrink-0 ${inactive ? 'bg-muted/50 border-dashed text-muted-foreground' : ''}`}>
      <CardHeader className="gap-1 pb-3">
        <CardDescription className="text-xs">Question {questionNumber}</CardDescription>
        <CardTitle className="text-lg leading-snug line-clamp-2">{question.title}</CardTitle>
        <div className="text-xs text-muted-foreground capitalize">{question.type}</div>
        {inactive && <div className="text-xs font-medium text-muted-foreground">Inactive</div>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="mx-auto flex h-36 w-36 cursor-pointer items-center justify-center rounded-lg border bg-card/80"
          onClick={onOpenQr}
        >
          {qrReady ? (
            <QRCodeCanvas value={resultsUrl} size={140} includeMargin />
          ) : (
            <div className="h-32 w-32 rounded-md bg-muted" />
          )}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onViewResults}>
            <ExternalLink className="mr-2 h-4 w-4" />
            View Results
          </Button>
          <Button variant="outline" size="icon" onClick={onOpenQr}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
