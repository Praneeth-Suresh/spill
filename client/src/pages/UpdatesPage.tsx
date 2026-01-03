import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import PointsBadge from "@/components/PointsBadge";
import Disclaimer from "@/components/Disclaimer";
import UpdatesCard from "@/components/UpdatesCard";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

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
        <h2 className="text-2xl font-bold leading-tight">Good spill!</h2>
      </div>

      {/* Question-specific updates card */}
      <div className="mb-6">
        {questionId ? (
          <UpdatesCard
            title="Updates for this question"
            updates={questionUpdates}
            isLoading={questionUpdatesLoading && !questionUpdates}
            emptyText="No updates for this question yet."
          />
        ) : (
          <div className="spill-card">
            <h3 className="font-semibold mb-2">Question-specific updates</h3>
            <p className="text-sm text-muted-foreground">
              Open a question and submit a response to see its updates here.
            </p>
          </div>
        )}
      </div>

      {/* General updates card */}
      <div className="spill-card space-y-4">
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
      </div>

      <div className="mt-6">
        <Disclaimer title="About Results" description="Results update in real-time as new responses come in. Your feedback shapes what we improve next. Thank you for participating!" />
      </div>
    </div>
  );
}
