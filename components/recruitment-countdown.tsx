"use client";

import { useEffect, useState } from "react";
import { kolkataWallClockToUtc } from "@/lib/deadlines";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

export type CountdownState = "upcoming" | "today" | "past";
export type CountdownUrgency = "safe" | "warn" | "danger";

interface CountdownParts {
  state: CountdownState;
  /** ms until the test date's Kolkata calendar day begins — only set while state === "upcoming". */
  msLeft: number | null;
  urgency: CountdownUrgency | null;
}

/** Splits a "YYYY-MM-DD" key into the {year, month, day} shape kolkataWallClockToUtc expects. */
function parseDateKeyParts(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month: month - 1, day };
}

/**
 * Live countdown to a `test_date` ("YYYY-MM-DD", Asia/Kolkata calendar day)
 * that may be days away — deadline-countdown.tsx's 24h-baseline logic
 * doesn't fit a test that isn't necessarily today or tomorrow. Ticks once a
 * minute (day/hour resolution doesn't need per-second updates like the
 * same-day deadline badge does), and reuses lib/deadlines.ts for the
 * Kolkata-wall-clock math rather than reinventing it.
 *
 * Three states: "upcoming" (still counting down to the start of that
 * Kolkata day), "today" (the test date has arrived), "past" (that whole
 * Kolkata day has elapsed and no result may have been logged). Returns
 * `state: "upcoming", msLeft: null` until mounted, mirroring
 * useDeadlineCountdown's hydration-safe pattern so server and first client
 * render match.
 */
export function useRecruitmentCountdown(testDate: string | null): CountdownParts {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!testDate) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [testDate]);

  if (!testDate || now === null) return { state: "upcoming", msLeft: null, urgency: null };

  const parts = parseDateKeyParts(testDate);
  const dayStart = kolkataWallClockToUtc(parts, 0, 0, 0).getTime();
  const dayEnd = kolkataWallClockToUtc({ ...parts, day: parts.day + 1 }, 0, 0, 0).getTime();

  if (now >= dayEnd) return { state: "past", msLeft: null, urgency: null };
  if (now >= dayStart) return { state: "today", msLeft: null, urgency: null };

  const msLeft = dayStart - now;
  const daysLeft = Math.floor(msLeft / DAY_MS);
  const urgency: CountdownUrgency = daysLeft >= 3 ? "safe" : daysLeft >= 1 ? "warn" : "danger";
  return { state: "upcoming", msLeft, urgency };
}

function formatTimeLeft(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return minutes > 0 ? `${minutes}m left` : "Starting soon";
}

const URGENCY_BADGE: Record<CountdownUrgency, string> = {
  safe: "bg-moss-soft text-moss",
  warn: "bg-amber-soft text-amber",
  danger: "bg-rust-soft text-rust",
};

/** Small pill showing days/hours left, "Today", or "Date passed" — colored by urgency, same visual language as DeadlineBadge. */
export function RecruitmentCountdownBadge({ state, msLeft, urgency }: CountdownParts) {
  if (state === "past") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rust-soft px-2.5 py-1 text-xs text-rust">
        <span aria-hidden="true">&#9888;</span>
        Date passed
      </span>
    );
  }

  if (state === "today") {
    return (
      <span className="inline-flex shrink-0 animate-pulse items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-xs text-amber">
        <span aria-hidden="true">&#9203;</span>
        Today
      </span>
    );
  }

  if (msLeft === null || urgency === null) return null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs tabular-nums",
        URGENCY_BADGE[urgency]
      )}
    >
      {formatTimeLeft(msLeft)}
    </span>
  );
}
