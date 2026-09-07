"use client";

import { useState, useTransition } from "react";
import { syncLeetcodePotdNow } from "@/actions/leetcode";
import { cn } from "@/lib/utils";

export function LeetcodeSyncButton({
  activityId,
  compact = false,
}: {
  activityId: string;
  compact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await syncLeetcodePotdNow(activityId);
        setMessage(result.solved ? "Solved \u2713" : "Not yet today");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Sync failed");
      }
    });
  }

  return (
    <div className={cn("flex shrink-0 items-center gap-2", compact ? "text-xs" : "text-sm")}>
      {message && <span className="text-ink-soft">{message}</span>}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded border border-line px-2 py-1 text-ink-soft transition-colors hover:border-moss hover:text-ink disabled:opacity-50"
      >
        {isPending ? "Checking\u2026" : "Check now"}
      </button>
    </div>
  );
}
