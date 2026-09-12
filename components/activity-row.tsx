"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { logCompletion } from "@/actions/completions";
import { LeetcodeSyncButton } from "@/components/leetcode-sync-button";
import { GfgSyncButton } from "@/components/gfg-sync-button";
import { DeadlineBadge, useDeadlineCountdown, type Urgency } from "@/components/deadline-countdown";
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
}: {
  activity: Activity;
  completion: Completion | null;
  periodKey: string;
  deadline?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [count, setCount] = useState<number>(completion?.value ?? 0);
  const { msLeft, urgency } = useDeadlineCountdown(deadline);

  const isDone = completion?.completed ?? false;
  const isLeetcode = activity.is_automated && activity.automation_type === "leetcode_potd";
  const isGfg = activity.is_automated && activity.automation_type === "gfg_potd";
  const isScreenTime = activity.is_automated && activity.automation_type === "screen_time";
  const isAutomated = isLeetcode || isGfg || isScreenTime;

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
        "flex items-center gap-4 border-b border-l-[3px] border-line py-4 pl-3 pr-1 last:border-b-0 transition-colors",
        isDone ? "border-l-transparent opacity-70" : urgency ? URGENCY_RULE[urgency] : "border-l-transparent"
      )}
    >
      <button
        type="button"
        onClick={activity.completion_type === "boolean" && !isAutomated ? toggleBoolean : undefined}
        disabled={activity.completion_type !== "boolean" || isPending || isAutomated}
        aria-pressed={isDone}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded border text-sm transition-colors",
          isDone
            ? "border-moss bg-moss text-paper"
            : "border-line bg-card text-ink-soft hover:border-moss"
        )}
      >
        {isDone ? "\u2713" : ""}
      </button>

      <div className="min-w-0 flex-1">
        <Link
          href={`/activities/${activity.id}`}
          className={cn(
            "block truncate text-sm hover:underline underline-offset-2",
            isDone ? "text-ink-soft line-through decoration-ink-soft/50" : "text-ink"
          )}
        >
          <span className="mr-1">{activity.icon}</span>
          {activity.name}
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

      {isLeetcode && <LeetcodeSyncButton activityId={activity.id} compact autoSyncActive={!isDone} />}
      {isGfg && <GfgSyncButton activityId={activity.id} compact autoSyncActive={!isDone} />}

      {!isAutomated && activity.completion_type === "count" && (
        <div className="flex shrink-0 items-center gap-2 font-mono text-sm">
          <button
            type="button"
            onClick={() => submitCount(Math.max(0, count - 1))}
            disabled={isPending}
            className="h-7 w-7 rounded border border-line text-ink-soft hover:border-moss hover:text-ink"
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
            className="h-7 w-7 rounded border border-line text-ink-soft hover:border-moss hover:text-ink"
            aria-label="Increase"
          >
            +
          </button>
        </div>
      )}
    </li>
  );
}
