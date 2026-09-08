"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { logCompletion } from "@/actions/completions";
import { LeetcodeSyncButton } from "@/components/leetcode-sync-button";
import { GfgSyncButton } from "@/components/gfg-sync-button";
import type { Activity, Completion } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ActivityRow({
  activity,
  completion,
  periodKey,
}: {
  activity: Activity;
  completion: Completion | null;
  periodKey: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [count, setCount] = useState<number>(completion?.value ?? 0);

  const isDone = completion?.completed ?? false;
  const isLeetcode = activity.is_automated && activity.automation_type === "leetcode_potd";
  const isGfg = activity.is_automated && activity.automation_type === "gfg_potd";
  const isAutomated = isLeetcode || isGfg;

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
    <li className="flex items-center gap-4 border-b border-line py-4 last:border-b-0">
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
          className="block truncate text-sm text-ink hover:underline underline-offset-2"
        >
          <span className="mr-1">{activity.icon}</span>
          {activity.name}
        </Link>
        {activity.description && (
          <p className="mt-0.5 truncate text-xs text-ink-soft">{activity.description}</p>
        )}
        {isLeetcode && <p className="mt-0.5 text-xs text-ink-soft">Auto-tracked via LeetCode</p>}
        {isGfg && <p className="mt-0.5 text-xs text-ink-soft">Auto-tracked via GFG</p>}
      </div>

      {isLeetcode && <LeetcodeSyncButton activityId={activity.id} compact />}
      {isGfg && <GfgSyncButton activityId={activity.id} compact />}

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
