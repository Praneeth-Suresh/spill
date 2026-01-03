import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Paragraphs } from "@/pages/UpdatesPage";

/**
 * UpdatesCard is a reusable component for displaying a list of updates.
 *
 * ## Features:
 * - Used on both Results and Updates pages.
 * - Can display updates for a specific question (by filtering on questionId) or general updates.
 * - Shows loading and empty states.
 * - Optionally displays the question number tag for each update.
 *
 * ## Differences from previous updates components:
 * - Centralizes update rendering logic for consistency across pages.
 * - Accepts props to control title, loading, empty state, and question tagging.
 * - Makes it easy to show updates for a specific question or all updates, depending on context.
 *
 * ## Usage:
 * ```
 * <UpdatesCard
 *   title="Updates for this question"
 *   updates={questionUpdates}
 *   isLoading={questionUpdatesLoading}
 *   emptyText="No updates for this question yet."
 * />
 * ```
 */

export type UpdateItem = {
  id: number;
  date: string | Date;
  person: string;
  paragraphs: string[];
  questionId?: number | null;
};

interface UpdatesCardProps {
  title: string;
  updates?: UpdateItem[] | null;
  isLoading?: boolean;
  emptyText?: string;
  showQuestionTag?: boolean;
  className?: string;
}

export function UpdatesCard({
  title,
  updates,
  isLoading,
  emptyText = "No updates yet.",
  showQuestionTag = false,
  className,
}: UpdatesCardProps) {
  const hasUpdates = Boolean(updates && updates.length > 0);

  return (
    <div className={["spill-card", className].filter(Boolean).join(" ")}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading updates" />}
      </div>

      {isLoading && !hasUpdates ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading updates" />
        </div>
      ) : hasUpdates ? (
        <div className="space-y-4">
          {updates!.map((update) => (
            <div key={update.id} className="pb-4 border-b border-black/10 last:border-none">
              <div className="text-sm text-muted-foreground mb-1">
                {format(new Date(update.date), "dd MMM yyyy, HH:mm")} — {update.person}
                {showQuestionTag && update.questionId ? ` (Q${update.questionId})` : ""}
              </div>
              <div className="space-y-3 text-sm leading-relaxed">
                <Paragraphs text={typeof update.paragraphs === "string" ? update.paragraphs : update.paragraphs.join("\n\n")} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

export default UpdatesCard;
