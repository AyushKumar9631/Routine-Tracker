import type { Activity, Completion } from "@/lib/types";
import { formatDateKey, isDueOn, kolkataToday, todayKey } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { studyHeatmapLevel, type StudyHeatmapLevel } from "@/lib/study-timer";

/** Reuses the app's existing moss/amber/rust/line palette — no new colors. */
const STUDY_LEVEL_CLASS: Record<StudyHeatmapLevel, string> = {
  empty: "bg-line/30",
  low: "bg-rust/60",
  mid: "bg-amber/70",
  high: "bg-moss",
};

export function CompletionHeatmap({
  activity,
  completions,
  weeks = 18,
  compact = false,
}: {
  activity: Activity;
  completions: Completion[];
  /** How many weeks of history to render. Defaults to the full 18-week view used on the activity detail page. */
  weeks?: number;
  /** Smaller cells, tighter gaps, no legend — for embedding inside a dashboard card. */
  compact?: boolean;
}) {
  const isStudyTimer = activity.automation_type === "study_timer";
  const completedKeys = new Set(completions.filter((c) => c.completed).map((c) => c.period_key));
  const valueByKey = new Map(completions.map((c) => [c.period_key, c.value]));
  const today = todayKey();

  const end = kolkataToday();
  end.setDate(end.getDate() + (6 - end.getDay())); // extend to end of this week (Saturday)
  const start = new Date(end);
  start.setDate(start.getDate() - weeks * 7 + 1);

  const columns: Date[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < weeks; w++) {
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
    if (isStudyTimer) {
      return STUDY_LEVEL_CLASS[studyHeatmapLevel(valueByKey.get(key), activity.target_value)];
    }
    const due = isDueOn(activity, date);
    if (!due) return "bg-line/30";
    if (completedKeys.has(key)) return "bg-moss";
    if (key === today) return "bg-amber-soft border border-amber";
    return "bg-rust/70";
  }

  const cellSize = compact ? "h-[9px] w-[9px] rounded-[2px]" : "h-3 w-3 rounded-sm";
  const gap = compact ? "gap-[2px]" : "gap-[3px]";

  return (
    <div>
      <div className={cn("flex overflow-x-auto pb-1", gap)}>
        {columns.map((col, i) => (
          <div
            key={i}
            className={cn("flex flex-col animate-heat-pop", gap)}
            style={{ animationDelay: `${i * 14}ms` }}
          >
            {col.map((date, j) => (
              <div
                key={j}
                title={formatDateKey(date)}
                className={cn(cellSize, "transition-transform duration-150 hover:scale-125", cellClass(date))}
              />
            ))}
          </div>
        ))}
      </div>
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-soft">
          {isStudyTimer ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded-sm inline-block", STUDY_LEVEL_CLASS.high)} /> 90%+ of goal
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded-sm inline-block", STUDY_LEVEL_CLASS.mid)} /> 50&ndash;90%
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded-sm inline-block", STUDY_LEVEL_CLASS.low)} /> under 50%
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded-sm inline-block", STUDY_LEVEL_CLASS.empty)} /> no study
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-moss inline-block" /> done
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-rust/70 inline-block" /> missed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-line/30 inline-block" /> not due
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
