"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { syncLeetcodePotdNow } from "@/actions/leetcode";
import { AUTO_SYNC_POLL_MS } from "@/lib/sync-config";
import { cn } from "@/lib/utils";

export function LeetcodeSyncButton({
  activityId,
  compact = false,
  autoSyncActive = false,
}: {
  activityId: string;
  compact?: boolean;
  /** Pass true while today isn't marked solved yet — runs a background poll every ~15s. */
  autoSyncActive?: boolean;
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
