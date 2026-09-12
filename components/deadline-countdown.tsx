"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** deadlineFor() always resolves to "midnight tonight", so a full day is the natural 100% baseline for how much time is left. */
const DAY_MS = 24 * 60 * 60 * 1000;

export type Urgency = "safe" | "warn" | "danger" | "over";

function formatTimeLeft(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * Live per-second countdown to `deadline`. Returns nulls until mounted, so
 * the server-rendered markup and the first client render match exactly —
 * the real value fills in a moment later via the effect, avoiding a
 * hydration mismatch on a clock-driven value.
 */
export function useDeadlineCountdown(deadline: string | null) {
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setMsLeft(null);
      return;
    }
    const target = new Date(deadline).getTime();
    const tick = () => setMsLeft(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (msLeft === null) return { msLeft: null, urgency: null as Urgency | null };

  const pctLeft = (msLeft / DAY_MS) * 100;
  const urgency: Urgency = msLeft <= 0 ? "over" : pctLeft < 20 ? "danger" : pctLeft < 50 ? "warn" : "safe";
  return { msLeft, urgency };
}

const URGENCY_BADGE: Record<Urgency, string> = {
  safe: "bg-moss-soft text-moss",
  warn: "bg-amber-soft text-amber",
  danger: "bg-rust-soft text-rust animate-pulse",
  over: "bg-rust-soft text-rust",
};

/** Small ticking pill showing time left, colored by how much of the day remains. */
export function DeadlineBadge({ msLeft, urgency }: { msLeft: number | null; urgency: Urgency | null }) {
  if (msLeft === null || urgency === null) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs tabular-nums",
        URGENCY_BADGE[urgency]
      )}
    >
      <span aria-hidden="true">{urgency === "over" ? "\u26a0" : "\u23f3"}</span>
      {urgency === "over" ? "Past deadline" : `${formatTimeLeft(msLeft)} left`}
    </span>
  );
}
