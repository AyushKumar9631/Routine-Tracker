"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { startStudyTimer, stopStudyTimer, notifyStudyGoalReached } from "@/actions/study-timer";
import { ActivityIcon } from "@/components/activity-icon";
import { formatScreenTimeLong } from "@/lib/screentime";
import { formatStudyClock, liveElapsedSeconds } from "@/lib/study-timer";
import { cn, isImageIcon } from "@/lib/utils";

/** A short ascending three-note chime via the Web Audio API — no audio file to ship or host. */
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
    // Web Audio unsupported/blocked — the sound is a nice-to-have, never block on it.
  }
}

function showBrowserNotification(activityName: string, icon: string | null) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("Study goal reached", {
      body: `${activityName} \u2014 nice work. The timer is now counting overtime.`,
      icon: isImageIcon(icon) ? (icon as string) : undefined,
    });
  } catch {
    // Some browsers (mobile Safari) support the permission but not `new Notification()` directly.
  }
}

export function StudyTimerCard({
  activityId,
  activityName,
  activityIcon,
  goalMinutes,
  runningSince: initialRunningSince,
  baseMinutes: initialBaseMinutes,
  notifyOnGoal,
}: {
  activityId: string;
  activityName: string;
  activityIcon: string | null;
  goalMinutes: number | null;
  runningSince: string | null;
  baseMinutes: number;
  notifyOnGoal: boolean;
}) {
  const [runningSince, setRunningSince] = useState(initialRunningSince);
  const [baseMinutes, setBaseMinutes] = useState(initialBaseMinutes);
  const [tick, setTick] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevRemainingRef = useRef<number | null>(null);
  const notifiedForSessionRef = useRef<string | null>(null);

  // Live per-second tick while a session is running. Starts null so the
  // server-rendered markup and the first client render match exactly (same
  // trick as useDeadlineCountdown) — the real elapsed time fills in a
  // moment later via this effect.
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

  // A fresh session (new Start) always begins by just recording its
  // baseline tick — never treated as "just crossed zero" even if it starts
  // already over goal (e.g. stop/restart later the same day).
  useEffect(() => {
    prevRemainingRef.current = null;
  }, [runningSince]);

  const goalSeconds = (goalMinutes ?? 0) * 60;
  const liveSeconds = tick === null ? 0 : liveElapsedSeconds(runningSince, tick);
  const studiedSeconds = baseMinutes * 60 + liveSeconds;
  const remaining = goalSeconds - studiedSeconds;

  useEffect(() => {
    if (!runningSince || tick === null || !goalMinutes) return;
    const prev = prevRemainingRef.current;
    prevRemainingRef.current = remaining;

    if (
      notifyOnGoal &&
      prev !== null &&
      prev > 0 &&
      remaining <= 0 &&
      notifiedForSessionRef.current !== runningSince
    ) {
      notifiedForSessionRef.current = runningSince;
      playChime(audioCtxRef);
      showBrowserNotification(activityName, activityIcon);
      notifyStudyGoalReached(activityId).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, tick, runningSince]);

  function handleStart() {
    setError(null);
    // Unlock audio + ask for notification permission on this user gesture —
    // both need one, and this click is the only one we're guaranteed to get.
    try {
      const Ctx =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = audioCtxRef.current ?? new Ctx();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") ctx.resume();
      }
    } catch {
      // ignore — sound just won't be available
    }
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    startTransition(async () => {
      try {
        const config = await startStudyTimer(activityId);
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
        const result = await stopStudyTimer(activityId);
        setBaseMinutes(result.totalMinutes);
        setRunningSince(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't stop the timer");
      }
    });
  }

  const isRunning = Boolean(runningSince);
  const goalReached = remaining <= 0;

  return (
    <div className="mb-6 rounded border border-line bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActivityIcon icon={activityIcon} className="text-base" />
          <span className="text-sm text-ink-soft">{activityName}</span>
        </div>
        {goalMinutes != null && (
          <span className="text-xs text-ink-soft">Goal {formatScreenTimeLong(goalMinutes)}</span>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <div
          className={cn(
            "font-mono text-5xl tabular-nums",
            goalReached ? "text-moss" : isRunning ? "text-ink" : "text-ink-soft"
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {formatStudyClock(remaining)}
        </div>
        <p className="text-xs text-ink-soft">
          {formatScreenTimeLong(Math.max(0, studiedSeconds) / 60)} studied
          {goalReached ? " \u2014 overtime counting" : " so far"}
        </p>

        <button
          type="button"
          onClick={isRunning ? handleStop : handleStart}
          disabled={isPending || !goalMinutes}
          className={cn(
            "mt-1 rounded px-6 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50",
            isRunning ? "bg-rust" : "bg-moss"
          )}
        >
          {isPending ? "\u2026" : isRunning ? "Stop" : "Start"}
        </button>

        {!goalMinutes && (
          <p className="text-xs text-rust">Set a daily goal by editing this activity to start the timer.</p>
        )}
        {error && <p className="text-xs text-rust">{error}</p>}
      </div>
    </div>
  );
}
