import type { Activity, Completion } from "@/lib/types";
import { formatDateKey, isDueOn, kolkataToday, todayKey } from "@/lib/utils";
import { cn } from "@/lib/utils";

const WEEKS = 18;

export function CompletionHeatmap({
  activity,
  completions,
}: {
  activity: Activity;
  completions: Completion[];
}) {
  const completedKeys = new Set(completions.filter((c) => c.completed).map((c) => c.period_key));
  const today = todayKey();

  const end = kolkataToday();
  end.setDate(end.getDate() + (6 - end.getDay())); // extend to end of this week (Saturday)
  const start = new Date(end);
  start.setDate(start.getDate() - WEEKS * 7 + 1);

  const columns: Date[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < WEEKS; w++) {
    const col: Date[] = [];
    for (let d = 0; d < 7; d++) {
      col.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(col);
  }

  function cellClass(date: Date) {
    const key = formatDateKey(date);
    if (key > today) return "bg-transparent";
    const due = isDueOn(activity, date);
    if (!due) return "bg-line/30";
    if (completedKeys.has(key)) return "bg-moss";
    if (key === today) return "bg-amber-soft border border-amber";
    return "bg-rust/70";
  }

  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {col.map((date, j) => (
              <div
                key={j}
                title={formatDateKey(date)}
                className={cn("h-3 w-3 rounded-sm", cellClass(date))}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-moss inline-block" /> done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-rust/70 inline-block" /> missed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-line/30 inline-block" /> not due
        </span>
      </div>
    </div>
  );
}
