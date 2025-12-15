import { useEffect } from "react";
import { useLocation } from "wouter";
import PointsBadge from "@/components/PointsBadge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const FALLBACK_MESSAGE = "All your feedback has collected and is being processed. Magic is happening. We'll let you know when the results are ready.";

function formatDate(value: Date | string) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
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
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, error } = trpc.updates.top.useQuery(undefined, {
    retry: 1,
  });

  useEffect(() => {
    if (error?.data?.code === "FORBIDDEN") {
      setLocation("/");
    }
  }, [error, setLocation]);

  const showFallback = isError;

  return (
    <div className="spill-mobile-card">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">spill.</h1>
        <PointsBadge />
      </div>

      <div className="mb-5">
        <h2 className="text-2xl font-bold leading-tight">Good spill.</h2>
        <p className="text-lg font-semibold leading-tight">See what&apos;s happening with your feedback.</p>
      </div>

      <div className="spill-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="italic font-semibold text-base">Updates</h3>
          {isLoading && (
            <Loader2 className="h-5 w-5 animate-spin text-black" aria-label="Loading updates" />
          )}
        </div>

        <div className={cn("rounded-xl border border-black/40 bg-white px-4 py-3", "h-[420px] overflow-y-auto")}> 
          {showFallback ? (
            <div className="text-sm leading-relaxed">
              <Paragraphs text={FALLBACK_MESSAGE} />
            </div>
          ) : data ? (
            <div className="space-y-4">
              {data.map((update) => (
                <div key={update.id} className="border border-black/40 rounded-xl p-4 shadow-sm bg-white">
                  <div className="text-sm font-semibold mb-3">
                    {formatDate(update.date)}, {update.person}
                  </div>
                  <div className="text-sm leading-relaxed">
                    {update.paragraphs.map((para, idx) => (
                      <p key={idx} className={idx === 0 ? "" : "mt-3"}>
                        {para}
                      </p>
                    ))}
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
    </div>
  );
}
