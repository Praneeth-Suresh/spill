import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import PointsBadge from "@/components/PointsBadge";
import Disclaimer from "@/components/Disclaimer";
import UpdatesCard from "@/components/UpdatesCard";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useFeature } from "@/hooks/useGrowthBook";

const FALLBACK_MESSAGE = "All your feedback has collected and is being processed. Magic is happening! We'll let you know when the results are ready.";

function formatDate(value: Date | string) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function Paragraphs({ text }: { text: string }) {
  // Convert literal "\n" to actual newlines
  const normalized = text.replace(/\\n/g, "\n");
  return (
    <>
      {normalized
        .split(/\n\n+/)
        .filter(Boolean)
        .map((chunk, idx) => (
          <p key={idx} className={idx === 0 ? "" : "mt-3"}>
            {chunk}
          </p>
        ))}
    </>
  );
}

export default function UpdatesPage() {
  const [, params] = useRoute("/updates/:id");
  const [, setLocation] = useLocation();
  const questionId = params?.id ? parseInt(params.id) : null;

  const { data: topUpdates, isLoading, isError, error } = trpc.updates.top.useQuery(undefined, {
    retry: 1,
  });

  const { data: questionUpdates, isLoading: questionUpdatesLoading } = trpc.updates.byQuestion.useQuery(
    { questionId: questionId!, limit: 5 },
    { enabled: !!questionId }
  );

  // A/B test: hide updates card for questions 6 and 7
  const showUpdatesQ6 = useFeature("hide-question-updates-q6", true, undefined, 6);
  const showUpdatesQ7 = useFeature("hide-question-updates-q7", true, undefined, 7);
  
  // Determine if we should show the updates card based on question ID
  const shouldShowUpdatesCard = !questionId || 
    (questionId !== 6 && questionId !== 7) || 
    (questionId === 6 && showUpdatesQ6) || 
    (questionId === 7 && showUpdatesQ7);

  useEffect(() => {
    if (error?.data?.code === "FORBIDDEN") {
      setLocation("/");
    }
  }, [error, setLocation]);

  const showFallback = isError;

  return (
    <div className="spill-mobile-card">
      <div className="flex items-center justify-between mb-6">
        <a href="/" className="text-3xl font-bold hover:underline">spill.</a>
        <PointsBadge />
      </div>

      <div className="mb-5">
        <h2 className="text-2xl font-bold leading-tight">Good spill.</h2>
      </div>

      {/* Question-specific updates card */}
      {shouldShowUpdatesCard && (
        <div className="mb-6">
          {questionId ? (
            <UpdatesCard
              title="What's been spilt?"
              updates={questionUpdates}
              isLoading={questionUpdatesLoading && !questionUpdates}
              emptyText="Hold tight! As responses come in, we'll keep you posted!"
            />
          ) : (
            <div className="spill-card">
              <h3 className="font-semibold mb-2">Question-specific updates</h3>
              <p className="text-sm text-muted-foreground">
                Open a question and submit a response to see what's been spilt here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Elsewhere on spill */}
      {/* <div className="spill-card space-y-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="italic font-semibold text-base">Elsewhere on spill</h3>
          {isLoading && (
            <Loader2 className="h-5 w-5 animate-spin text-black" aria-label="Loading updates" />
          )}
        </div>

        <div className="h-[420px] overflow-y-auto">
          {showFallback ? (
            <div className="text-sm leading-relaxed">
              <Paragraphs text={FALLBACK_MESSAGE} />
            </div>
          ) : topUpdates ? (
            <div className="space-y-4">
              {topUpdates.map((update) => (
                <div key={update.id} className="pb-4 border-b border-black/15 last:border-none">
                  <div className="text-sm font-semibold mb-2">
                    {formatDate(update.date)}, {update.person}
                  </div>
                  <div className="text-sm leading-relaxed">
                    <Paragraphs text={typeof update.paragraphs === "string"
                      ? update.paragraphs
                      : Array.isArray(update.paragraphs)
                        ? update.paragraphs.join("\n\n")
                        : ""}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-black" aria-label="Loading updates" />
            </div>
          )}
        </div>
      </div> */}

      <div className="spill-card space-y-4">
        <h3 className="font-semibold mb-2">Thank you for the spill!</h3>
        <div className="text-sm text-muted-foreground mb-2">
          A bit more about what we do!
        </div>

        <div className="text-base leading-relaxed text-gray-800 space-y-3">
          <p>
            <i>We</i> are building a space for <i>you</i> to spill your thoughts. 
            We're doing this to make society better: to close the loop between desires and outcomes.
          </p>
          <p>
            See what's happening with your feedback on our 
            <a
              href="https://t.me/spilltoday"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "oklch(0.95 0.25 127)",
                color: "#000", // or use a variable for best contrast
                padding: "0 4px",
                borderRadius: "4px"
              }}
            >
              Telegram channel (join by clicking here)
            </a>
            !
          </p>
          <p><i>
            Thank you for being part of the spill community!
          </i></p>
          <p>
            Your voice matters, and together we can make a difference.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Disclaimer title="About Results" description="Results update in real-time as new responses come in. Your feedback shapes what we improve next. Thank you for participating!" />
      </div>
    </div>
  );
}
