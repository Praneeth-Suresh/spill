import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CircleDollarSign } from "lucide-react";

interface PointsBadgeProps {
  className?: string;
}

export function PointsBadge({ className }: PointsBadgeProps) {
  const { data: pointsData, isLoading } = trpc.points.current.useQuery();
  const fallback = Number(import.meta.env.VITE_DEFAULT_POINTS ?? 0);
  const points = pointsData?.points ?? fallback;

  return (
    <div className={cn("bg-white border-2 border-black rounded-2xl px-4 py-2 shadow-sm flex items-center gap-3 min-w-[120px] justify-between", className)}>
      <div className="flex items-center justify-center rounded-full border-2 border-black bg-primary h-9 w-9">
        <CircleDollarSign className="h-5 w-5 text-black" />
      </div>
      {isLoading ? (
        <div className="h-5 w-14 rounded bg-black/10 animate-pulse" />
      ) : (
        <span className="text-xl font-semibold tabular-nums">{points.toLocaleString()}</span>
      )}
    </div>
  );
}

export default PointsBadge;
