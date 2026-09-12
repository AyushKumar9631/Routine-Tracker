// Deadline/threshold math for the LeetCode POTD notify cron. Pure functions
// only — no DB or fetch calls, so these are trivial to unit test.
//
// Single-user app, user is in India: Asia/Kolkata is hardcoded rather than
// built as per-user config. India has no DST, so the offset is a fixed
// +5:30 — no need for Intl/timezone-database lookups, just arithmetic.

const KOLKATA_OFFSET_MINUTES = 5 * 60 + 30;

interface KolkataDateParts {
  year: number;
  month: number; // 0-indexed, matches Date.UTC
  day: number;
}

/** Today's Y/M/D as seen on an Asia/Kolkata wall clock, for a given instant. */
export function getKolkataDateParts(now: Date): KolkataDateParts {
  const shifted = new Date(now.getTime() + KOLKATA_OFFSET_MINUTES * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

/** UTC instant corresponding to a given Asia/Kolkata wall-clock date + time. */
export function kolkataWallClockToUtc(
  parts: KolkataDateParts,
  hour: number,
  minute: number,
  second = 0
): Date {
  // Date.UTC correctly rolls over day/month overflow (e.g. day 32 -> next month),
  // which todaysDeadline below relies on for "tomorrow".
  return new Date(
    Date.UTC(parts.year, parts.month, parts.day, hour, minute, second) -
      KOLKATA_OFFSET_MINUTES * 60000
  );
}

/**
 * Parses a Postgres `time` value ("HH:MM" or "HH:MM:SS") into its parts.
 * Returns null for anything malformed or out of range, so callers can fall
 * back cleanly instead of throwing on bad data.
 */
export function parseTimeOfDay(
  value: string
): { hour: number; minute: number; second: number } | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] ? Number(match[3]) : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;

  return { hour, minute, second };
}

/** Today's date as a "YYYY-MM-DD" key, Asia/Kolkata calendar day. */
export function todaysDateKey(now: Date = new Date()): string {
  const { year, month, day } = getKolkataDateParts(now);
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/**
 * Today's deadline for a daily activity: midnight at the *end* of today,
 * Asia/Kolkata — i.e. the start of tomorrow, Kolkata wall-clock time.
 */
export function todaysDeadline(now: Date = new Date()): Date {
  const parts = getKolkataDateParts(now);
  return kolkataWallClockToUtc({ ...parts, day: parts.day + 1 }, 0, 0, 0);
}

/**
 * Today's notify threshold: `preferredCompleteBy` (Kolkata wall-clock time)
 * if it's set and parses cleanly, else the deadline minus 2 hours.
 * Computed fresh each call — never stored as a resolved value.
 */
export function todaysNotifyThreshold(
  now: Date = new Date(),
  preferredCompleteBy?: string | null
): Date {
  const deadline = todaysDeadline(now);

  if (preferredCompleteBy) {
    const parsed = parseTimeOfDay(preferredCompleteBy);
    if (parsed) {
      const parts = getKolkataDateParts(now);
      return kolkataWallClockToUtc(parts, parsed.hour, parsed.minute, parsed.second);
    }
  }

  return new Date(deadline.getTime() - 2 * 60 * 60 * 1000);
}
