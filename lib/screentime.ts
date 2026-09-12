// Jomo's "Get Screentime" Shortcuts action returns a formatted duration
// string (e.g. "3h 24m", "45m", "1h") rather than a raw number, and users
// may wire the Shortcut's "Get Contents of URL" body differently, so the
// webhook has to accept either a plain minutes value or that string format.

import { formatDateKey, parseDateKey } from "@/lib/utils";

/** Parses a screen-time value into whole minutes, or null if unrecognized. */
export function parseScreenTimeMinutes(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return normalizeMaybeSeconds(raw);
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // Plain number as a string, e.g. "204", "204.5", or (as it turns out,
  // this is what Jomo's raw "Get Screentime" value actually is) "2400"
  // meaning 2400 *seconds*.
  if (/^\d+(\.\d+)?$/.test(trimmed)) return normalizeMaybeSeconds(Number(trimmed));

  // "3h 24m", "3h", "45m", "45 min", etc.
  const hoursMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minutesMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*m/i);
  if (hoursMatch || minutesMatch) {
    const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
    const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
    return Math.round(hours * 60 + minutes);
  }

  return null;
}

// A day only has 1440 minutes, so any bare number above that is
// unambiguously seconds, not minutes — no need to guess which unit the
// source actually meant, the value itself proves it.
const MAX_MINUTES_PER_DAY = 1440;
function normalizeMaybeSeconds(value: number): number {
  return value > MAX_MINUTES_PER_DAY ? Math.round(value / 60) : Math.round(value);
}

/** Best-effort extraction of the screen-time value from a webhook body of unknown shape. */
export function extractScreenTimeValue(body: unknown): unknown {
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    return obj.value ?? obj.screenTime ?? obj.screentime ?? obj.minutes ?? obj.duration ?? null;
  }
  return body ?? null;
}

/** "2:15" (hours:minutes) for a minutes count. "--:--" when there's no value yet. */
export function formatScreenTime(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "--:--";
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}:${String(mins).padStart(2, "0")}`;
}

export interface ScreenTimeStats {
  todayMinutes: number | null;
  weeklyAverageMinutes: number | null;
  overallAverageMinutes: number | null;
  weekLowestMinutes: number | null;
}

/** Rolls a screen-time activity's completion history into the numbers the "Today" gauge card shows. */
export function computeScreenTimeStats(
  completions: { period_key: string; value: number | null }[],
  todayDateKey: string
): ScreenTimeStats {
  const todayMinutes =
    completions.find((c) => c.period_key === todayDateKey)?.value ?? null;

  const allValues = completions.map((c) => c.value).filter((v): v is number => v != null);
  const overallAverageMinutes =
    allValues.length > 0 ? Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length) : null;

  const last7Keys = new Set<string>();
  const cursor = parseDateKey(todayDateKey);
  for (let i = 0; i < 7; i++) {
    last7Keys.add(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  const last7Values = completions
    .filter((c) => last7Keys.has(c.period_key))
    .map((c) => c.value)
    .filter((v): v is number => v != null);

  const weeklyAverageMinutes =
    last7Values.length > 0
      ? Math.round(last7Values.reduce((a, b) => a + b, 0) / last7Values.length)
      : null;
  const weekLowestMinutes = last7Values.length > 0 ? Math.min(...last7Values) : null;

  return { todayMinutes, weeklyAverageMinutes, overallAverageMinutes, weekLowestMinutes };
}

export type ScreenTimeLevel = "moss" | "amber" | "rust";

/** Green under 80% of the daily limit, amber 81-110%, red beyond that. No limit set = always green. */
export function screenTimeLevel(minutes: number, limitMinutes: number | null): ScreenTimeLevel {
  if (!limitMinutes || limitMinutes <= 0) return "moss";
  const pct = (minutes / limitMinutes) * 100;
  if (pct <= 80) return "moss";
  if (pct <= 110) return "amber";
  return "rust";
}

// The gauge's arc represents 0 -> 150% of the limit; beyond that it just stays fully filled.
// With no limit set, fall back to a fixed 4-hour reference scale so the gauge still reads sensibly.
const NO_LIMIT_REFERENCE_MINUTES = 240;
const GAUGE_OVERSHOOT = 1.5;

/** 0-1 fraction of the gauge arc to fill for a given screen-time total. */
export function screenTimeFillFraction(minutes: number, limitMinutes: number | null): number {
  const scale = limitMinutes && limitMinutes > 0 ? limitMinutes * GAUGE_OVERSHOOT : NO_LIMIT_REFERENCE_MINUTES;
  return Math.max(0, Math.min(minutes / scale, 1));
}
