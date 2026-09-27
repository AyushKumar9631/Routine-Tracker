"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { startStudyTimer, stopStudyTimer, notifyStudyGoalReached, completeStudyTimer } from "@/actions/study-timer";
import type { Activity, Completion } from "@/lib/types";
import { calcStreak, cn, formatDateKey, isImageIcon, parseDateKey } from "@/lib/utils";

// Study Timer brand colors - green theme
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

/** Vertical speedometer with stacked curved bars - tapered shape */
function VerticalSpeedometer({ percentage, isDark }: { percentage: number; isDark: boolean }) {
  const bars = 10;
  const filledBars = Math.floor((percentage / 100) * bars);

  return (
    <div className="flex flex-col-reverse items-end gap-1" style={{ width: '100px' }}>
      {Array.from({ length: bars }).map((_, i) => {
        const isFilled = i < filledBars;
        // Width decreases as we go up (0 = bottom/widest, 9 = top/narrowest)
        const barWidth = 100 - i * 8; // 100px at bottom, 28px at top
        const barHeight = 6;

        return (
          <div
            key={i}
            className="relative transition-all duration-300"
            style={{
              width: `${barWidth}px`,
              height: `${barHeight}px`,
              opacity: 0,
              animation: `fadeIn 0.35s ease-out ${i * 0.04}s forwards`,
            }}
          >
            <svg
              width={barWidth}
              height={barHeight}
              viewBox={`0 0 ${barWidth} ${barHeight}`}
              className="w-full h-full"
            >
              <rect
                x="0"
                y="0"
                width={barWidth}
                height={barHeight}
                rx="2"
                fill={isFilled ? ACCENT : (isDark ? "#3A3A3A" : "#E5E5E5")}
                stroke={isFilled ? ACCENT : (isDark ? "#4A4A4A" : "#D5D5D5")}
                strokeWidth="0.5"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

/** A short ascending three-note chime via the Web Audio API */
function playChime(ctxRef: { current: AudioContext | null }) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = ctxRef.current ?? new Ctx();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    [0, 0.18, 0.36].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = i === 2 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.18);
    });
  } catch {
    // Web Audio unsupported/blocked
  }
}

function showBrowserNotification(activityName: string, icon: string | null) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("Study goal reached", {
      body: `${activityName} — nice work. The timer is now counting overtime.`,
      icon: isImageIcon(icon) ? (icon as string) : undefined,
    });
  } catch {
    // Some browsers don't support new Notification()
  }
}

export function StudyTimerCard({
  activity,
  completion,
  periodKey,
  heatmapCompletions,
  runningSince: initialRunningSince,
  baseMinutes: initialBaseMinutes,
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

  const [runningSince, setRunningSince] = useState(initialRunningSince);
  const [baseMinutes, setBaseMinutes] = useState(initialBaseMinutes);
  const [tick, setTick] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevRemainingRef = useRef<number | null>(null);
  const notifiedForSessionRef = useRef<string | null>(null);

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
    if (!runningSince) {
      setTick(null);
      return;
    }
    const update = () => setTick(Date.now());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [runningSince]);

  useEffect(() => {
    prevRemainingRef.current = null;
  }, [runningSince]);

  const goalSeconds = goalMinutes * 60;
  const liveSeconds = tick === null ? 0 : liveElapsedSeconds(runningSince, tick);
  const studiedSeconds = baseMinutes * 60 + liveSeconds;
  const remaining = goalSeconds - studiedSeconds;

  useEffect(() => {
    if (!runningSince || tick === null || !goalMinutes) return;
    const prev = prevRemainingRef.current;
    prevRemainingRef.current = remaining;

    if (
      prev !== null &&
      prev > 0 &&
      remaining <= 0 &&
      notifiedForSessionRef.current !== runningSince
    ) {
      notifiedForSessionRef.current = runningSince;
      playChime(audioCtxRef);
      showBrowserNotification(activity.name, activity.icon);
      notifyStudyGoalReached(activity.id).catch(() => {});
    }
  }, [remaining, tick, runningSince, goalMinutes, activity.name, activity.icon, activity.id]);

  function handleStart() {
    setError(null);
    try {
      const Ctx =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = audioCtxRef.current ?? new Ctx();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") ctx.resume();
      }
    } catch {}
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    startTransition(async () => {
      try {
        const config = await startStudyTimer(activity.id);
        setRunningSince(config.running_since);
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
        setBaseMinutes(result.totalMinutes);
        setRunningSince(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't stop the timer");
      }
    });
  }

  async function handleMarkDone() {
    setError(null);
    startTransition(async () => {
      try {
        await completeStudyTimer(activity.id, periodKey);
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't mark as complete");
      }
    });
  }

  const isRunning = Boolean(runningSince);
  const goalReached = remaining <= 0;
  const percentage = goalSeconds > 0 ? Math.min(100, Math.max(0, (studiedSeconds / goalSeconds) * 100)) : 0;

  return (
    <li
      ref={cardRef}
      className={cn(
        "group relative mb-4 overflow-hidden rounded-2xl border p-5 lg:mb-0 transition-all duration-300",
        "border-[#E5E5E5] bg-white text-[#262626]",
        "dark:border-[#3A3A3A] dark:bg-[#1A1A1A] dark:text-white",
        isRunning && "ring-pulse-moss"
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

        <div className={cn("flex shrink-0 items-center gap-1", isDone ? "text-moss" : "text-[#8A8A8A]")}>
          <FlameIcon className="h-4 w-4" />
          <span className="text-sm font-semibold tabular-nums">{streak}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex-1">
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
            onClick={isRunning ? handleStop : (isDone ? handleMarkDone : handleStart)}
            disabled={isPending || !goalMinutes}
            className={cn(
              "mt-3 rounded-lg px-6 py-2 text-sm font-semibold transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100",
              isRunning ? "bg-rust text-white" : "bg-moss text-white"
            )}
          >
            {isPending ? "…" : isRunning ? "Stop" : isDone ? "✓ Done" : "Start"}
          </button>

          {!goalMinutes && (
            <p className="mt-2 text-xs text-rust">Set a daily goal to start the timer.</p>
          )}
          {error && <p className="mt-2 text-xs text-rust">{error}</p>}
        </div>

        {!isDone && (
          <div className="flex items-center justify-end">
            <VerticalSpeedometer
              percentage={percentage}
              isDark={false}
            />
          </div>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-[#E5E5E5] dark:border-[#3A3A3A]">
        <div
          key={`sweep-${sweepRun}`}
          className="flex items-center gap-1.5"
          style={{
            ["--tally-accent" as string]: ACCENT,
            ["--tally-glow" as string]: ACCENT_GLOW,
          }}
        >
          {days.map((day, i) => {
            const isToday = day.key === periodKey;
            const animClass = day.done
              ? "tally-sweep-fill"
              : isToday && !isDone
              ? "tally-sweep-today"
              : "tally-sweep-empty";

            return (
              <div
                key={day.key}
                className={cn(
                  "h-7 w-[6px] rounded-sm",
                  sweepRun > 0 ? animClass : day.done ? "bg-moss" : "bg-[#E5E5E5] dark:bg-[#3A3A3A]"
                )}
                style={{
                  animationDelay: `${i * 50}ms`,
                  color: "#E5E5E5",
                  transform: `skewX(-8deg)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </li>
  );
}
