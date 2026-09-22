"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pauseQuickStopwatch, resumeQuickStopwatch, completeQuickStopwatch } from "@/actions/quick-stopwatch";
import { StopwatchIcon } from "@/components/stopwatch-icon";
import { formatStudyClock, liveElapsedSeconds } from "@/lib/study-timer";
import { cn } from "@/lib/utils";

export function QuickStopwatchRow({
  id,
  label,
  status: initialStatus,
  accumulatedSeconds: initialAccumulated,
  runningSince: initialRunningSince,
}: {
  id: string;
  label: string;
  status: "running" | "paused";
  accumulatedSeconds: number;
  runningSince: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [accumulated, setAccumulated] = useState(initialAccumulated);
  const [runningSince, setRunningSince] = useState(initialRunningSince);
  const [tick, setTick] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (status !== "running") {
      setTick(null);
      return;
    }
    const update = () => setTick(Date.now());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [status, runningSince]);

  // If the tab closes while this is still open (running or paused), the
  // server bills whatever's already banked plus any live elapsed time —
  // no need to sync client state first.
  useEffect(() => {
    function saveBeacon() {
      if (hasCompletedRef.current) return;
      navigator.sendBeacon(`/api/quick-stopwatches/${id}/complete`);
    }
    window.addEventListener("pagehide", saveBeacon);
    window.addEventListener("beforeunload", saveBeacon);
    return () => {
      window.removeEventListener("pagehide", saveBeacon);
      window.removeEventListener("beforeunload", saveBeacon);
    };
  }, [id]);

  const liveSeconds = tick === null ? 0 : liveElapsedSeconds(runningSince, tick);
  const totalSeconds = accumulated + liveSeconds;

  function handleToggle() {
    startTransition(async () => {
      if (status === "running") {
        const updated = await pauseQuickStopwatch(id);
        setAccumulated(updated.accumulated_seconds);
        setRunningSince(null);
        setStatus("paused");
      } else {
        const updated = await resumeQuickStopwatch(id);
        setRunningSince(updated.running_since);
        setStatus("running");
      }
    });
  }

  function handleComplete() {
    hasCompletedRef.current = true;
    startTransition(async () => {
      await completeQuickStopwatch(id);
      router.refresh();
    });
  }

  const isRunning = status === "running";

  return (
    <div
      className={cn(
        "card-interactive relative mb-6 rounded border border-line bg-card p-5 lg:rounded-xl",
        isRunning && "ring-pulse-amber"
      )}
    >
      <div className="mb-4 flex items-center gap-2">
        <StopwatchIcon className="h-4 w-4 text-ink-soft" />
        <span className="truncate text-sm text-ink-soft">{label}</span>
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <div className="relative flex h-36 w-36 items-center justify-center lg:h-44 lg:w-44">
          <svg
            viewBox="0 0 120 120"
            className={cn("absolute inset-0 h-full w-full", isRunning && "animate-spin-slow")}
            aria-hidden="true"
          >
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              strokeWidth="4"
              strokeDasharray="3 11"
              strokeLinecap="round"
              className={isRunning ? "stroke-amber" : "stroke-line"}
            />
          </svg>
          <div className="font-mono text-4xl tabular-nums text-ink lg:text-5xl">
            {formatStudyClock(totalSeconds)}
          </div>
        </div>
        <p className="text-xs text-ink-soft">{isRunning ? "studying now" : "paused"}</p>

        <div className="mt-1 flex gap-3">
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className="rounded border border-line px-5 py-2 text-sm font-medium text-ink transition-all duration-200 hover:scale-105 hover:border-moss active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isRunning ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={isPending}
            className="rounded bg-moss px-5 py-2 text-sm font-medium text-paper transition-all duration-200 hover:scale-105 hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}
