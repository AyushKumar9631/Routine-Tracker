"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { logCompletion } from "@/actions/completions";
import { LeetcodeSyncButton } from "@/components/leetcode-sync-button";
import { GfgSyncButton } from "@/components/gfg-sync-button";
import { DeadlineBadge, useDeadlineCountdown, type Urgency } from "@/components/deadline-countdown";
import { ActivityIcon } from "@/components/activity-icon";
import { CompletionHeatmap } from "@/components/completion-heatmap";
import type { Activity, Completion } from "@/lib/types";
import { cn } from "@/lib/utils";

const URGENCY_RULE: Record<Urgency, string> = {
  safe: "border-l-moss",
  warn: "border-l-amber",
  danger: "border-l-rust",
  over: "border-l-rust",
};

export function ActivityRow({
  activity,
  completion,
  periodKey,
  deadline = null,
  heatmapCompletions = [],
}: {
  activity: Activity;
  completion: Completion | null;
  periodKey: string;
  deadline?: string | null;
  /** Recent completion history for this activity's card heatmap (desktop only). */
  heatmapCompletions?: Completion[];
}) {
  const [isPending, startTransition] = useTransition();
  const [count, setCount] = useState<number>(completion?.value ?? 0);
  const { msLeft, urgency } = useDeadlineCountdown(deadline);

  const isDone = completion?.completed ?? false;
  const isLeetcode = activity.is_automated && activity.automation_type === "leetcode_potd";
  const isGfg = activity.is_automated && activity.automation_type === "gfg_potd";
  const isScreenTime = activity.is_automated && activity.automation_type === "screen_time";
  const isAutomated = isLeetcode || isGfg || isScreenTime;
  const hasFooter = isLeetcode || isGfg || (!isAutomated && activity.completion_type === "count");

  function toggleBoolean() {
    startTransition(async () => {
      await logCompletion(activity.id, periodKey, { completed: !isDone });
    });
  }

  function submitCount(next: number) {
    const target = activity.target_value ?? 0;
    setCount(next);
    startTransition(async () => {
      await logCompletion(activity.id, periodKey, {
        completed: next >= target,
        value: next,
      });
    });
  }

  return (
    <li
      className={cn(
        // Mobile (default): untouched — same single-row list item as before.
        "card-interactive flex items-center gap-4 border-b border-l-[3px] border-line py-4 pl-3 pr-1 transition-colors last:border-b-0",
        // Desktop (lg+): the same DOM becomes a self-contained card in a grid.
        "lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-hidden lg:rounded-xl lg:border-t lg:border-r lg:py-0 lg:pl-0 lg:pr-0 lg:bg-card lg:last:border-b",
        isDone ? "border-l-transparent opacity-70" : urgency ? URGENCY_RULE[urgency] : "border-l-transparent"
      )}
    >
      {/* Header: checkbox + name + deadline. `contents` on mobile means these
          render as plain flex siblings of the li (identical to before); at lg
          the div becomes a real row and forms the card's header. */}
      <div className="contents lg:flex lg:items-center lg:gap-3 lg:p-4">
        <button
          type="button"
          onClick={activity.completion_type === "boolean" && !isAutomated ? toggleBoolean : undefined}
          disabled={activity.completion_type !== "boolean" || isPending || isAutomated}
          aria-pressed={isDone}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded border text-sm transition-all duration-200",
            "lg:h-9 lg:w-9 lg:hover:scale-105 lg:active:scale-95",
            isDone ? "border-moss bg-moss text-paper" : "border-line bg-card text-ink-soft hover:border-moss"
          )}
        >
          {isDone ? "\u2713" : ""}
        </button>

        <div className="min-w-0 flex-1">
          <Link
            href={`/activities/${activity.id}`}
            className={cn(
              "flex items-center text-sm hover:underline underline-offset-2 lg:text-[0.95rem]",
              isDone ? "text-ink-soft line-through decoration-ink-soft/50" : "text-ink"
            )}
          >
            <ActivityIcon icon={activity.icon} className="mr-1.5 shrink-0" />
            <span className="min-w-0 truncate">{activity.name}</span>
            {(isLeetcode || isGfg) && (
              <span className="ml-2 hidden shrink-0 rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft lg:inline-block">
                {isLeetcode ? "LeetCode" : "GFG"}
              </span>
            )}
          </Link>
          {activity.description && (
            <p className="mt-0.5 truncate text-xs text-ink-soft">{activity.description}</p>
          )}
          {isLeetcode && <p className="mt-0.5 text-xs text-ink-soft">Auto-tracked via LeetCode</p>}
          {isGfg && <p className="mt-0.5 text-xs text-ink-soft">Auto-tracked via GFG</p>}
          {isScreenTime && (
            <p className="mt-0.5 text-xs text-ink-soft">
              Auto-tracked via Screen Time (iPhone)
              {completion?.value != null ? ` \u00b7 ${completion.value} min today` : ""}
            </p>
          )}
        </div>

        {!isDone && <DeadlineBadge msLeft={msLeft} urgency={urgency} />}
      </div>

      {/* Footer: sync button or count stepper. Same `contents` trick — only
          rendered when there's something to show, so a plain boolean
          activity's card doesn't grow an empty strip at lg. */}
      {hasFooter && (
        <div className="contents lg:flex lg:items-center lg:justify-end lg:gap-2 lg:border-t lg:border-line/70 lg:bg-paper/40 lg:px-4 lg:py-2.5">
          {isLeetcode && <LeetcodeSyncButton activityId={activity.id} compact autoSyncActive={!isDone} />}
          {isGfg && <GfgSyncButton activityId={activity.id} compact autoSyncActive={!isDone} />}

          {!isAutomated && activity.completion_type === "count" && (
            <div className="flex shrink-0 items-center gap-2 font-mono text-sm">
              <button
                type="button"
                onClick={() => submitCount(Math.max(0, count - 1))}
                disabled={isPending}
                className="h-7 w-7 rounded border border-line text-ink-soft transition-transform duration-150 hover:scale-110 hover:border-moss hover:text-ink active:scale-95"
                aria-label="Decrease"
              >
                &minus;
              </button>
              <span className={cn("w-16 text-center", isDone ? "text-moss" : "text-ink")}>
                {count} / {activity.target_value}
                {activity.unit_label ? ` ${activity.unit_label}` : ""}
              </span>
              <button
                type="button"
                onClick={() => submitCount(count + 1)}
                disabled={isPending}
                className="h-7 w-7 rounded border border-line text-ink-soft transition-transform duration-150 hover:scale-110 hover:border-moss hover:text-ink active:scale-95"
                aria-label="Increase"
              >
                +
              </button>
            </div>
          )}
        </div>
      )}

      {/* Heatmap: desktop-only, never rendered on mobile. */}
      <div className="hidden lg:block lg:border-t lg:border-line/70 lg:px-4 lg:py-3">
        <CompletionHeatmap activity={activity} completions={heatmapCompletions} weeks={10} compact />
      </div>
    </li>
  );
}
