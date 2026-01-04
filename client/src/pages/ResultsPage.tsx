import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Disclaimer from "@/components/Disclaimer";
import UpdatesCard from "@/components/UpdatesCard";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

/**
 * ResultsPage displays the results and updates for a specific question.
 * Shows response statistics, recent updates, and allows users to see
 * how their feedback is shaping the environment.
 */
export default function ResultsPage() {
  const [, params] = useRoute("/results/:id");
  const [, setLocation] = useLocation();
  const questionId = params?.id ? parseInt(params.id) : null;
  const hasQuestionContext = Number.isFinite(questionId);

  const { data: questionData, isLoading: questionLoading } = trpc.questions.getById.useQuery(
    { id: questionId! },
    { enabled: !!questionId }
  );

  const { data: stats, isLoading: statsLoading } = trpc.admin.getQuestionStats.useQuery(
    { questionId: questionId! },
    { enabled: !!questionId }
  );

  const { data: recentResponses } = trpc.admin.getRecentResponses.useQuery(
    { questionId: questionId!, limit: 5 },
    { enabled: !!questionId && questionData?.question.type !== 'poll' }
  );

  const { data: questionUpdates, isLoading: questionUpdatesLoading } = trpc.updates.byQuestion.useQuery(
    { questionId: questionId!, limit: 5 },
    { enabled: !!questionId }
  );

  const { data: latestUpdates, isLoading: latestUpdatesLoading } = trpc.updates.latest.useQuery(
    { limit: 3 },
    { enabled: !questionId }
  );

  if (!hasQuestionContext) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/40">
          <div className="container flex items-center justify-between py-4 max-w-5xl">
            <a href="/" className="text-2xl font-bold hover:underline">spill.</a>
            <Button variant="outline" onClick={() => setLocation("/")}>
              Back to Home
            </Button>
          </div>
        </header>

        <main className="container max-w-5xl py-8 space-y-6">
          <Card>
            <CardHeader>
              <CardDescription>Results landing</CardDescription>
              <CardTitle className="text-2xl">Good spill.</CardTitle>
              <p className="text-muted-foreground">Latest results and updates across your questions.</p>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Newest updates</CardTitle>
              <CardDescription>Fresh changes rolling out from recent feedback.</CardDescription>
            </CardHeader>
            <CardContent>
              <UpdatesCard
                title=""
                updates={latestUpdates}
                isLoading={latestUpdatesLoading && !latestUpdates}
                emptyText="No updates are available yet."
                showQuestionTag
                className="bg-card border rounded-xl shadow-none p-0"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setLocation("/")}>Back to Home</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Disclaimer title="About Results" description="Results update in real-time as new responses come in. Your feedback shapes what we improve next. Thank you for participating!" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (questionLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!questionData || !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Results not available</CardTitle>
            <CardDescription>We could not load the requested results.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { question } = questionData;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/40">
        <div className="container flex items-center justify-between py-4 max-w-5xl">
          <a href="/" className="text-2xl font-bold hover:underline">spill.</a>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLocation("/")}>Back to Home</Button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardDescription>Results overview</CardDescription>
            <CardTitle className="text-2xl leading-tight">{question.title}</CardTitle>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="font-medium capitalize">{question.type} question</span>
              <span>Question ID #{question.id}</span>
              <span className={question.isActive ? "text-green-700" : "text-muted-foreground"}>
                {question.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            {question.description && <p className="text-muted-foreground text-sm">{question.description}</p>}
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <div className="rounded-lg bg-primary/10 p-6 text-center">
                <div className="text-4xl font-bold mb-2">{stats.totalResponses}</div>
                <div className="text-sm text-muted-foreground">Total responses received</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent activity</CardTitle>
              <CardDescription>Latest feedback and updates for this question.</CardDescription>
            </CardHeader>
            <CardContent>
              {question.type !== 'poll' && recentResponses && recentResponses.length === 0 && (
                <p className="text-sm text-muted-foreground">No responses yet.</p>
              )}
              {question.type !== 'poll' && recentResponses && recentResponses.length > 0 && (
                <div className="space-y-3">
                  {recentResponses.slice(0, 3).map((response) => (
                    <div key={response.id} className="border-l-2 border-primary/60 pl-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        {format(new Date(response.submittedAt), 'dd MMM yyyy, HH:mm')}
                      </div>
                      <p className="text-sm leading-relaxed">{response.textAnswer}</p>
                    </div>
                  ))}
                </div>
              )}
              {question.type === 'poll' && (
                <p className="text-sm text-muted-foreground">Poll responses update in real time.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {question.type === 'poll' && stats.optionStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>Breakdown of votes per option.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.optionStats.map((stat) => {
                const percentage = stats.totalResponses > 0
                  ? Math.round((stat.count / stats.totalResponses) * 100)
                  : 0;

                return (
                  <div key={stat.optionId} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{stat.optionText}</span>
                      <span className="text-muted-foreground">{stat.count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {question.type !== 'poll' && recentResponses && recentResponses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Latest responses</CardTitle>
              <CardDescription>Most recent feedback submitted for this question.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentResponses.map((response) => (
                <div key={response.id} className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground mb-1">
                    {format(new Date(response.submittedAt), 'dd MMM yyyy, HH:mm')}
                  </div>
                  <p className="text-sm leading-relaxed">{response.textAnswer}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Updates for this question</CardTitle>
            <CardDescription>Change log and improvements tied to this feedback.</CardDescription>
          </CardHeader>
          <CardContent>
            <UpdatesCard
              title=""
              updates={questionUpdates}
              isLoading={questionUpdatesLoading && !questionUpdates}
              emptyText="No updates for this question yet."
              className="bg-card border rounded-xl shadow-none p-0"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg">Keep the feedback coming</CardTitle>
              <CardDescription>Your next submission updates these numbers instantly.</CardDescription>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <Button className="flex-1 md:flex-none" onClick={() => setLocation(`/question/${questionId}`)}>
                Submit Another Response
              </Button>
              <Button variant="outline" className="flex-1 md:flex-none" onClick={() => setLocation("/")}>
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Disclaimer title="About Results" description="Results update in real-time as new responses come in. Your feedback shapes what we improve next. Thank you for participating!" />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
