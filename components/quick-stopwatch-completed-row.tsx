import { StopwatchIcon } from "@/components/stopwatch-icon";
import { formatScreenTimeLong } from "@/lib/screentime";

export function QuickStopwatchCompletedRow({
  label,
  accumulatedSeconds,
}: {
  label: string;
  accumulatedSeconds: number;
}) {
  return (
    <li className="flex items-center gap-4 border-b border-l-[3px] border-l-transparent border-line py-4 pl-3 pr-1 opacity-70 last:border-b-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-moss bg-moss text-sm text-paper">
        &#10003;
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-sm text-ink-soft line-through decoration-ink-soft/50">
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
