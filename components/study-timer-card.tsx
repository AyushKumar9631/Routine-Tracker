"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Activity, Completion } from "@/lib/types";
import { calcStreak, cn, formatDateKey, isImageIcon, parseDateKey } from "@/lib/utils";

// Study Timer brand colors - green theme matching moss
const ACCENT = "#3F6B47"; // moss green
const ACCENT_GLOW = "rgba(63, 107, 71, 0.6)";

const STUDY_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function StudyTimerMark({ icon, className }: { icon?: string | null; className?: string }) {
  if (icon && isImageIcon(icon)) {
    return (
      <img src={icon} alt="" className={cn("h-9 w-9 shrink-0 rounded-lg object-contain", className)} />
    );
  }
  if (icon) {
    return (
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl", className)} aria-hidden="true">
        {icon}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white",
        className
      )}
      style={{ background: `linear-gradient(135deg, ${ACCENT}, #2A4A30)` }}
      aria-hidden="true"
    >
      ST
    </span>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.9 1.6c.6 3-.6 4.8-2.3 6.6C8.8 10 7 12 7 14.8a5 5 0 0 0 10 0c0-1.9-.8-3.2-1.7-4.4.2 1.7-.4 2.8-1.4 3.6-.2-1.5-1-2.5-2-3.4-1.5-1.4-3.1-2.9-1-9Z" />
    </svg>
  );
}

function last14Days(completions: Completion[], todayDateKey: string) {
  const completedKeys = new Set(completions.filter((c) => c.completed).map((c) => c.period_key));
  const cursor = parseDateKey(todayDateKey);
  cursor.setDate(cursor.getDate() - 13);

  const days: { key: string; done: boolean }[] = [];
  for (let i = 0; i < 14; i++) {
    const dayKey = formatDateKey(cursor);
    days.push({ key: dayKey, done: completedKeys.has(dayKey) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function StudyTimerCard({
  activity,
  completion,
  periodKey,
  heatmapCompletions,
  runningSince,
  baseMinutes,
}: {
  activity: Activity;
  completion: Completion | null;
  periodKey: string;
  heatmapCompletions: Completion[];
  runningSince: string | null;
  baseMinutes: number;
}) {
  const isDone = completion?.completed ?? false;
  const streak = calcStreak(activity, heatmapCompletions);
  const days = last14Days(heatmapCompletions, periodKey);

  const cardRef = useRef<HTMLLIElement>(null);
  const [sweepRun, setSweepRun] = useState(0);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setSweepRun((n) => n + 1);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <li
      ref={cardRef}
      className={cn(
        "group relative mb-4 overflow-hidden rounded-2xl border p-5 lg:mb-0",
        "border-[#E5E5E5] bg-white text-[#262626]",
        "dark:border-[#3A3A3A] dark:bg-[#1A1A1A] dark:text-white"
      )}
      style={{ fontFamily: STUDY_FONT }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <StudyTimerMark icon={activity.icon} />
          <div className="min-w-0">
            <Link
              href={`/activities/${activity.id}`}
              className="block truncate text-base font-bold leading-tight hover:underline underline-offset-2"
            >
              {activity.name || "Study Timer"}
            </Link>
          </div>
        </div>

        <div
          className={cn("flex shrink-0 items-center gap-1", isDone ? "text-moss" : "text-[#8A8A8A]")}
          title={`${streak}-day streak`}
        >
          <FlameIcon className={cn("h-5 w-5", isDone && "drop-shadow-[0_0_6px_rgba(63,107,71,0.65)]")} />
          <span className="text-lg font-extrabold tabular-nums">{streak}</span>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div
          key={sweepRun}
          className="flex items-end gap-1"
          style={{ "--tally-accent": ACCENT, "--tally-glow": ACCENT_GLOW } as React.CSSProperties}
        >
          {days.map((d, i) => {
            const isToday = i === days.length - 1;
            const stagger = i * 55;
            const sweepClass =
              sweepRun === 0 ? null : isToday && !d.done ? "tally-sweep-today" : d.done ? "tally-sweep-fill" : "tally-sweep-empty";
            return (
              <span
                key={d.key}
                title={d.key}
                className={cn(
                  "h-7 w-2 skew-x-[-12deg] text-[#262626]/10 transition-all duration-300 dark:text-white/10",
                  d.done ? "bg-moss shadow-[0_0_6px_rgba(63,107,71,0.6)]" : "bg-current",
                  sweepClass
                )}
                style={
                  sweepClass
                    ? {
                        animationDelay:
                          isToday && !d.done ? `${stagger}ms, ${stagger + 650}ms` : `${stagger}ms`,
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>
    </li>
  );
}
