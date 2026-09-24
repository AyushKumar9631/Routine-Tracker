"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { syncGfgPotdNow } from "@/actions/gfg";
import { AUTO_SYNC_POLL_MS } from "@/lib/sync-config";
import { cn } from "@/lib/utils";

export function GfgSyncButton({
  activityId,
  compact = false,
  autoSyncActive = false,
  variant = "default",
  initialSolved = false,
}: {
  activityId: string;
  compact?: boolean;
  /** Pass true while today isn't marked solved yet — runs a background poll every ~15s. */
  autoSyncActive?: boolean;
  /** "gfg" renders as a themed pill (see components/gfg-card.tsx) instead of the generic outline button. */
  variant?: "default" | "gfg";
  /** Today's completion state from the server, so the button reflects an already-solved POTD on load. */
  initialSolved?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [solved, setSolved] = useState(initialSolved);
  const runningRef = useRef(false);

  function runSync() {
    if (runningRef.current) return;
    runningRef.current = true;
    startTransition(async () => {
      try {
        const result = await syncGfgPotdNow(activityId);
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        setMessage(result.solvedToday ? "Solved \u2713" : `Streak: ${result.currentStreak}`);
        if (result.solvedToday) setSolved(true);
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

  if (variant === "gfg") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={solved ? "Today's GFG POTD solved" : "Check today's GFG submission"}
        className={cn(
          "shrink-0 rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-200",
          "active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0",
          solved
            ? "bg-[#0F9D58] text-white shadow-[0_2px_10px_rgba(15,157,88,0.35)] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_6px_18px_rgba(15,157,88,0.5)]"
            : "border-2 border-[#0F9D58] bg-transparent text-[#0F9D58] hover:-translate-y-0.5 hover:bg-[#0F9D58]/10"
        )}
      >
        {solved ? "Solved" : isPending ? "Checking\u2026" : "Check"}
      </button>
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
