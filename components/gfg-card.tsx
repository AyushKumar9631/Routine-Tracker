"use client";

import Link from "next/link";
import { GfgSyncButton } from "@/components/gfg-sync-button";
import type { Activity, Completion } from "@/lib/types";
import { calcStreak, cn, formatDateKey, isImageIcon, parseDateKey } from "@/lib/utils";

// GeeksforGeeks' official brand green (Simple Icons press-kit hex,
// https://www.geeksforgeeks.org/ source) — used site-wide for GFG's own
// buttons and marks, so this is the one accent this card borrows
// everywhere it needs a highlight (streak, tally, the unsolved button).
const ACCENT = "#0F9D58";

// GFG's practice-problem difficulty tags aren't documented anywhere with
// exact hex values (unlike LeetCode's, which are stable and well-known) —
// this is a best-effort palette anchored on the real brand green for
// Basic/Easy, not a verified live-page dump. Swap these if the live site's
// tags differ.
const DIFFICULTY_COLOR: Record<string, string> = {
  School: "#7C93A3",
  Basic: ACCENT,
  Easy: ACCENT,
  Medium: "#F2A93B",
  Hard: "#E1503C",
};

// Best-effort system stack, same reasoning as the LeetCode card — not
// verified against a live inspector session (this sandbox has no network
// access to geeksforgeeks.org).
const GFG_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Activity's own icon (set on the activity, e.g. a custom URL or emoji) when present, else the "GfG" badge. */
function GfgMark({ icon, className }: { icon?: string | null; className?: string }) {
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
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white",
        className
      )}
      style={{ background: `linear-gradient(135deg, ${ACCENT}, #0B7A43)` }}
      aria-hidden="true"
    >
      GfG
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

export function GfgCard({
  activity,
  completion,
  periodKey,
  heatmapCompletions,
  gfgUsername,
  difficulty,
}: {
  activity: Activity;
  completion: Completion | null;
  periodKey: string;
  /** Recent completion history (see app/page.tsx) — drives the streak count and the 14-day tally. */
  heatmapCompletions: Completion[];
  gfgUsername: string | null;
  /** Today's POTD difficulty, persisted by the last sync (lib/gfg-sync.ts) — null until the first check. */
  difficulty: string | null;
}) {
  const isDone = completion?.completed ?? false;
  const streak = calcStreak(activity, heatmapCompletions);
  const days = last14Days(heatmapCompletions, periodKey);
  const difficultyColor = difficulty ? DIFFICULTY_COLOR[difficulty] : null;

  return (
    <li
      className={cn(
        "gfg-card group relative mb-4 overflow-hidden rounded-2xl border p-5 lg:mb-0",
        "border-[#E5E5E5] bg-white text-[#262626]",
        "dark:border-[#3A3A3A] dark:bg-[#1A1A1A] dark:text-white"
      )}
      style={{ fontFamily: GFG_FONT }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <GfgMark icon={activity.icon} />
          <div className="min-w-0">
            <Link
              href={`/activities/${activity.id}`}
              className="block truncate text-base font-bold leading-tight hover:underline underline-offset-2"
            >
              {activity.name || "GeeksforGeeks"}
            </Link>
            {gfgUsername && <p className="truncate text-xs font-medium text-[#8A8A8A]">@{gfgUsername}</p>}
          </div>
        </div>

        <div
          className={cn("flex shrink-0 items-center gap-1", isDone ? "text-[#0F9D58]" : "text-[#8A8A8A]")}
          title={`${streak}-day streak`}
        >
          <FlameIcon className={cn("h-5 w-5", isDone && "drop-shadow-[0_0_6px_rgba(15,157,88,0.65)]")} />
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
        <div className="flex items-end gap-1">
          {days.map((d) => (
            <span
              key={d.key}
              title={d.key}
              className={cn(
                "h-7 w-2 skew-x-[-12deg] transition-all duration-300",
                d.done ? "bg-[#0F9D58] shadow-[0_0_6px_rgba(15,157,88,0.6)]" : "bg-[#262626]/10 dark:bg-white/10"
              )}
            />
          ))}
        </div>

        <GfgSyncButton activityId={activity.id} variant="gfg" autoSyncActive={!isDone} initialSolved={isDone} />
      </div>
    </li>
  );
}
