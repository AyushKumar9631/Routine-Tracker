import { StopwatchIcon } from "@/components/stopwatch-icon";
import { formatScreenTimeLong } from "@/lib/screentime";
import { cn } from "@/lib/utils";

export function QuickStopwatchCompletedRow({
  label,
  accumulatedSeconds,
}: {
  label: string;
  accumulatedSeconds: number;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-4 border-b border-l-[3px] border-l-transparent border-line py-4 pl-3 pr-1 opacity-70 last:border-b-0",
        "lg:items-stretch lg:gap-3 lg:rounded-xl lg:border-t lg:border-r lg:py-0 lg:pl-0 lg:pr-0 lg:bg-card lg:p-4 lg:last:border-b"
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-moss bg-moss text-sm text-paper lg:h-9 lg:w-9">
        &#10003;
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-sm text-ink-soft line-through decoration-ink-soft/50 lg:text-[0.95rem]">
          <StopwatchIcon className="h-3.5 w-3.5 shrink-0" />
          {label}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">
          Quick stopwatch &middot; {formatScreenTimeLong(accumulatedSeconds / 60)} studied
        </p>
      </div>
    </li>
  );
}
