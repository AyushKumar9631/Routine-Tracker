"use client";

import { useEffect, useRef, useState } from "react";
import { StopwatchIcon } from "@/components/stopwatch-icon";
import { formatStudyClock } from "@/lib/study-timer";
import { cn } from "@/lib/utils";

const ACCENT = "#3F6B47"; // moss green
const ACCENT_GLOW = "rgba(63, 107, 71, 0.6)";

const STUDY_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.9 1.6c.6 3-.6 4.8-2.3 6.6C8.8 10 7 12 7 14.8a5 5 0 0 0 10 0c0-1.9-.8-3.2-1.7-4.4.2 1.7-.4 2.8-1.4 3.6-.2-1.5-1-2.5-2-3.4-1.5-1.4-3.1-2.9-1-9Z" />
    </svg>
  );
}

export function StopwatchCompletedCard({
  label,
  accumulatedSeconds,
  streak,
  days,
}: {
  label: string;
  accumulatedSeconds: number;
  streak: number;
  days: { key: string; done: boolean }[];
}) {
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
        "group relative mb-4 overflow-hidden rounded-xl border p-6 lg:mb-0 transition-all duration-300 hover:shadow-lg",
        "border-[#E5E5E5] bg-white text-[#262626]",
        "dark:border-[#3A3A3A] dark:bg-[#1A1A1A] dark:text-white",
        "hover:border-moss/40 dark:hover:border-moss/40"
      )}
      style={{ fontFamily: STUDY_FONT }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-1.5 text-white"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #2A4A30)` }}
            aria-hidden="true"
          >
            <StopwatchIcon className="h-full w-full" />
          </span>
          <span className="block truncate text-base font-bold leading-tight">{label}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1 text-moss" title={`${streak}-day streak`}>
          <FlameIcon className="h-5 w-5 drop-shadow-[0_0_6px_rgba(63,107,71,0.65)]" />
          <span className="text-lg font-extrabold tabular-nums">{streak}</span>
        </div>
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <div
          className="text-4xl font-bold tabular-nums"
          style={{ fontVariantNumeric: "tabular-nums", color: ACCENT }}
        >
          {formatStudyClock(accumulatedSeconds)}
        </div>
        <span className="text-sm text-[#8A8A8A]">studied</span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div
          key={sweepRun}
          className="flex items-end gap-1"
          style={{ "--tally-accent": ACCENT, "--tally-glow": ACCENT_GLOW } as React.CSSProperties}
        >
          {days.map((d, i) => {
            const stagger = i * 55;
            const sweepClass = sweepRun === 0 ? null : d.done ? "tally-sweep-fill" : "tally-sweep-empty";
            return (
              <span
                key={d.key}
                title={d.key}
                className={cn(
                  "h-7 w-2 skew-x-[-12deg] text-[#262626]/10 transition-all duration-300 dark:text-white/10 hover:scale-110",
                  d.done ? "bg-moss shadow-[0_0_6px_rgba(63,107,71,0.6)]" : "bg-current",
                  sweepClass
                )}
                style={sweepClass ? { animationDelay: `${stagger}ms` } : undefined}
              />
            );
          })}
        </div>
      </div>
    </li>
  );
}
