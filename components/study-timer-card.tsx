"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { startStudyTimer, stopStudyTimer } from "@/actions/study-timer";
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

function liveElapsedSeconds(startedAt: string | null, nowMs: number): number {
  if (!startedAt) return 0;
  const started = new Date(startedAt).getTime();
  return Math.floor((nowMs - started) / 1000);
}

function formatTimeRemaining(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const h = Math.floor(absSeconds / 3600);
  const m = Math.floor((absSeconds % 3600) / 60);
  const s = absSeconds % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return seconds < 0 ? `-${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

/** Vertical completion tracker - diagonal stacked bars */
function CompletionTracker({ percentage }: { percentage: number }) {
  const bars = 10;
  const filledBars = Math.floor((percentage / 100) * bars);
  const maxWidth = 60;
  const minWidth = 10;

  return (
    <div className="flex flex-col gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => {
        const isFilled = i < filledBars;
        // Top bar is widest, bottom bar is narrowest (diagonal right edge)
        const barWidth = maxWidth - (i * (maxWidth - minWidth)) / (bars - 1);

        return (
          <div
            key={i}
            style={{
              width: `${barWidth}px`,
              height: '6px',
              backgroundColor: isFilled ? ACCENT : '#3A3A3A',
              opacity: 0,
              animation: `fadeIn 0.35s ease-out ${i * 0.04}s forwards`,
            }}
          />
        );
      })}
    </div>
  );
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
  const goalMinutes = activity.target_value ?? 0;

  const [localRunningSince, setLocalRunningSince] = useState(runningSince);
  const [localBaseMinutes, setLocalBaseMinutes] = useState(baseMinutes);
  const [tick, setTick] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!localRunningSince) {
      setTick(null);
      return;
    }
    const update = () => setTick(Date.now());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [localRunningSince]);

  const goalSeconds = goalMinutes * 60;
  const liveSeconds = tick === null ? 0 : liveElapsedSeconds(localRunningSince, tick);
  const studiedSeconds = localBaseMinutes * 60 + liveSeconds;
  const remaining = goalSeconds - studiedSeconds;

  function handleStart() {
    setError(null);
    startTransition(async () => {
      try {
        const config = await startStudyTimer(activity.id);
        setLocalRunningSince(config.running_since);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start the timer");
      }
    });
  }

  function handleStop() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await stopStudyTimer(activity.id);
        setLocalBaseMinutes(result.totalMinutes);
        setLocalRunningSince(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't stop the timer");
      }
    });
  }

  const isRunning = Boolean(localRunningSince);
  const goalReached = remaining <= 0;
  const percentage = goalSeconds > 0 ? Math.min(100, Math.max(0, (studiedSeconds / goalSeconds) * 100)) : 0;

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

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="text-4xl font-bold tabular-nums"
            style={{
              fontVariantNumeric: "tabular-nums",
              color: goalReached ? ACCENT : (isRunning ? "inherit" : "#8A8A8A")
            }}
          >
            {formatTimeRemaining(remaining)}
          </div>

          <button
            type="button"
            onClick={isRunning ? handleStop : handleStart}
            disabled={isPending || !goalMinutes}
            className={cn(
              "rounded-lg px-6 py-2 text-sm font-semibold transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100",
              isRunning ? "bg-rust text-white" : "bg-moss text-white"
            )}
          >
            {isPending ? "…" : isRunning ? "Stop" : "Start"}
          </button>
        </div>

        {!isDone && <CompletionTracker percentage={percentage} />}
      </div>

      {!goalMinutes && (
        <p className="mt-2 text-xs text-rust">Set a daily goal to start the timer.</p>
      )}
      {error && <p className="mt-2 text-xs text-rust">{error}</p>}

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
