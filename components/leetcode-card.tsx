"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LeetcodeSyncButton } from "@/components/leetcode-sync-button";
import type { Activity, Completion } from "@/lib/types";
import { calcStreak, cn, formatDateKey, isImageIcon, parseDateKey } from "@/lib/utils";

// LeetCode's own difficulty colors — the same standard values used across
// its problem list, problem header, and profile stats (light and dark).
const DIFFICULTY_COLOR: Record<string, string> = {
  Easy: "#00B8A3",
  Medium: "#FFC01E",
  Hard: "#FF375F",
};

// LeetCode's brand gold — used site-wide for streaks, the active nav item,
// and selected/premium states. This is the one accent this card borrows
// everywhere it needs a highlight.
const ACCENT = "#FFA116";
const ACCENT_GLOW = "rgba(255, 161, 22, 0.6)";

// LeetCode's own UI isn't set in a custom webfont — it renders in the
// platform's native system font, so this matches it exactly rather than
// approximating with a Google Font.
const LEETCODE_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Activity's own icon (set on the activity, e.g. a custom URL or emoji) when present, else the "LC" badge. */
function LeetcodeMark({ icon, className }: { icon?: string | null; className?: string }) {
  if (icon && isImageIcon(icon)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
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
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black text-[#1A1A1A]",
        className
      )}
      style={{ background: `linear-gradient(135deg, ${ACCENT}, #B87400)` }}
      aria-hidden="true"
    >
      LC
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

/** Last 14 calendar days (oldest first), each flagged done/not — the card's tally strip. */
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

export function LeetcodeCard({
  activity,
  completion,
  periodKey,
  heatmapCompletions,
  leetcodeUsername,
  difficulty,
}: {
  activity: Activity;
  completion: Completion | null;
  periodKey: string;
  /** Recent completion history (see app/page.tsx) — drives the streak count and the 14-day tally. */
  heatmapCompletions: Completion[];
  leetcodeUsername: string | null;
  /** Today's POTD difficulty, persisted by the last sync (lib/leetcode-sync.ts) — null until the first check. */
  difficulty: string | null;
}) {
  const isDone = completion?.completed ?? false;
  const streak = calcStreak(activity, heatmapCompletions);
  const days = last14Days(heatmapCompletions, periodKey);
  const difficultyColor = difficulty ? DIFFICULTY_COLOR[difficulty] : null;

  // Replays the tally-strip sweep (app/globals.css) every time the card
  // scrolls into view, not just once — sweepRun starts at 0 (render the
  // real state, unanimated, so there's no flash of the wrong state before
  // JS runs) and bumps on every intersection after that; the days row is
  // keyed on it so React remounts the boxes and CSS restarts the animation.
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
        "leetcode-card group relative mb-4 overflow-hidden rounded-2xl border p-5 lg:mb-0",
        "border-[#E5E5E5] bg-white text-[#262626]",
        "dark:border-[#3A3A3A] dark:bg-[#1A1A1A] dark:text-white"
      )}
      style={{ fontFamily: LEETCODE_FONT }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <LeetcodeMark icon={activity.icon} />
          <div className="min-w-0">
            <Link
              href={`/activities/${activity.id}`}
              className="block truncate text-base font-bold leading-tight hover:underline underline-offset-2"
            >
              {activity.name || "LeetCode"}
            </Link>
            {leetcodeUsername && (
              <p className="truncate text-xs font-medium text-[#8A8A8A]">@{leetcodeUsername}</p>
            )}
          </div>
        </div>

        <div
          className={cn("flex shrink-0 items-center gap-1", isDone ? "text-[#FFA116]" : "text-[#8A8A8A]")}
          title={`${streak}-day streak`}
        >
          <FlameIcon className={cn("h-5 w-5", isDone && "drop-shadow-[0_0_6px_rgba(255,161,22,0.65)]")} />
          <span className="text-lg font-extrabold tabular-nums">{streak}</span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center">
        {difficulty && difficultyColor ? (
          <span
            className="rounded-md px-3 py-1 text-sm font-bold uppercase tracking-wide"
            style={{ color: difficultyColor, backgroundColor: `${difficultyColor}1A` }}
          >
            {difficulty}
          </span>
        ) : (
          <span className="text-sm font-medium text-[#8A8A8A]">Syncing today&rsquo;s problem&hellip;</span>
        )}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div
          key={sweepRun}
          className="flex items-end gap-1"
          style={{ "--tally-accent": ACCENT, "--tally-glow": ACCENT_GLOW } as CSSProperties}
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
                  d.done ? "bg-[#FFA116] shadow-[0_0_6px_rgba(255,161,22,0.6)]" : "bg-current",
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

        <LeetcodeSyncButton
          activityId={activity.id}
          variant="leetcode"
          autoSyncActive={!isDone}
          initialSolved={isDone}
        />
      </div>
    </li>
  );
}
