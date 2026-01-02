import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import PointsBadge from "@/components/PointsBadge";
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
      <div className="spill-mobile-card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">spill.</h1>
          <PointsBadge />
        </div>

        <div className="spill-card mb-6">
          <h2 className="text-2xl font-bold mb-2">Good spill.</h2>
          <p className="text-lg">Latest results and updates.</p>
        </div>

        <div className="spill-card mb-6">
          <UpdatesCard
            title="Newest updates"
            updates={latestUpdates}
            isLoading={latestUpdatesLoading && !latestUpdates}
            emptyText="No updates are available yet."
            showQuestionTag
          />
        </div>

        <Button onClick={() => setLocation("/")} className="spill-button w-full mb-3">
          Back to Home
        </Button>

        <div className="mt-6">
          <Disclaimer title="About Results" description="Results update in real-time as new responses come in. Your feedback shapes what we improve next. Thank you for participating!" />
        </div>
      </div>
    );
  }

  if (questionLoading || statsLoading) {
    return (
      <div className="spill-mobile-card flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!questionData || !stats) {
    return (
      <div className="spill-mobile-card flex items-center justify-center">
        <div className="spill-card text-center">
          <h2 className="text-xl font-bold mb-4">Results not available</h2>
          <Button onClick={() => setLocation("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const { question } = questionData;

  return (
    <div className="spill-mobile-card">
      <div className="flex items-center justify-between mb-6">
        <a href="/" className="text-3xl font-bold hover:underline">spill.</a>
        <PointsBadge />
      </div>

      {/* Title Card */}
      <div className="spill-card mb-6">
        <h2 className="text-2xl font-bold mb-2">Good spill.</h2>
        <p className="text-lg">See what's happening with your feedback.</p>
      </div>
      
      {/* Total Responses */}
      <div className="spill-card mb-6 text-center">
        <div className="text-4xl font-bold mb-2">{stats.totalResponses}</div>
        <div className="text-sm text-muted-foreground">Total responses received</div>
      </div>

      {/* Results Card - For Poll Questions */}
      {question.type === 'poll' && stats.optionStats.length > 0 && (
        <div className="spill-card mb-6">
          <h3 className="font-semibold mb-4">Results</h3>
          <div className="space-y-3">
            {stats.optionStats.map((stat) => {
              const percentage = stats.totalResponses > 0 
                ? Math.round((stat.count / stats.totalResponses) * 100) 
                : 0;
              
              return (
                <div key={stat.optionId} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{stat.optionText}</span>
                    <span className="text-sm text-muted-foreground">{stat.count}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-[6px] h-2">
                    <div
                      className="bg-primary h-2 rounded-[6px] transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <UpdatesCard
        title="Updates for this question"
        updates={questionUpdates}
        isLoading={questionUpdatesLoading && !questionUpdates}
        emptyText="No updates for this question yet."
      />

      {/* Updates Card - For Text Questions */}
      {question.type !== 'poll' && recentResponses && recentResponses.length > 0 && (
        <div className="spill-card mb-6">
          <h3 className="font-semibold mb-4">Updates</h3>
          <div className="space-y-4">
            {recentResponses.map((response) => (
              <div key={response.id} className="border-l-2 border-primary pl-4">
                <div className="text-sm text-muted-foreground mb-1">
                  {format(new Date(response.submittedAt), 'dd MMM yyyy, HH:mm')}
                </div>
                <p className="text-sm">{response.textAnswer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={() => setLocation(`/question/${questionId}`)}
          className="spill-button w-full"
        >
          Submit Another Response
        </Button>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          className="w-full"
        >
          Back to Home
        </Button>
      </div>

      <div className="mt-6">
        <Disclaimer title="About Results" description="Results update in real-time as new responses come in. Your feedback shapes what we improve next. Thank you for participating!" />
      </div>
    </div>
  );
}
