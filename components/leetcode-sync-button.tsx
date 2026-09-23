"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { syncLeetcodePotdNow } from "@/actions/leetcode";
import { AUTO_SYNC_POLL_MS } from "@/lib/sync-config";
import { cn } from "@/lib/utils";

export function LeetcodeSyncButton({
  activityId,
  compact = false,
  autoSyncActive = false,
  variant = "default",
}: {
  activityId: string;
  compact?: boolean;
  /** Pass true while today isn't marked solved yet — runs a background poll every ~15s. */
  autoSyncActive?: boolean;
  /** "leetcode" renders as a themed pill (see components/leetcode-card.tsx) instead of the generic outline button. */
  variant?: "default" | "leetcode";
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const runningRef = useRef(false);

  function runSync() {
    if (runningRef.current) return; // never overlap a manual click with a poll tick
    runningRef.current = true;
    startTransition(async () => {
      try {
        const result = await syncLeetcodePotdNow(activityId);
        setMessage(result.solved ? "Solved \u2713" : "Not yet today");
        if (result.solved) setSolved(true);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Sync failed");
      } finally {
        runningRef.current = false;
      }
    });
  }

  // Auto-poll in the background while this activity isn't solved for today.
  // Stops the moment a check comes back solved, and pauses (without
  // dropping the schedule) while the tab isn't visible.
  useEffect(() => {
    if (!autoSyncActive || solved) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    function schedule() {
      timer = setTimeout(tick, AUTO_SYNC_POLL_MS);
    }

    function tick() {
      if (cancelled) return;
      if (!document.hidden) runSync();
      schedule();
    }

    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncActive, solved, activityId]);

  function handleClick() {
    setMessage(null);
    runSync();
  }

  if (variant === "leetcode") {
    return (
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          aria-label="Check today's LeetCode submission"
          className={cn(
            "rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-200",
            "bg-[#FFA116] text-[#1A1A1A] shadow-[0_2px_10px_rgba(255,161,22,0.35)]",
            "hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_6px_18px_rgba(255,161,22,0.5)]",
            "active:translate-y-0 active:brightness-95 disabled:opacity-60 disabled:hover:translate-y-0"
          )}
        >
          {isPending ? "Checking\u2026" : "Check"}
        </button>
        {message && <span className="text-[10px] text-[#8A8A8A]">{message}</span>}
      </div>
    );
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
