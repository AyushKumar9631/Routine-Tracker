// Recruitment reminder threshold math — pure functions only, no DB or fetch
// calls, so these are trivial to unit test (mirrors the style of
// lib/deadlines.ts, and reuses its Kolkata wall-clock math rather than
// reinventing it).
//
// Scope note: per the plan doc's section 1.5, a reminder is actually due
// only once four conditions all hold — the Kolkata date/time trigger below,
// *and* `notified_{evening,morning}_sent = false`, *and* `result =
// 'awaiting'`. The two functions here only ever decide the date/time part
// (tomorrow/>=19:00 for evening, today/>=09:00 for morning) — they take a
// bare `test_date`, not a whole round, and know nothing about
// `notified_*_sent` or `result`. The caller (the E2 cron route, and E3's SQL
// gate) combines this with those two round-state fields itself.

import { getKolkataDateParts, kolkataWallClockToUtc, todaysDateKey } from "./deadlines";

/** "YYYY-MM-DD" for the Kolkata calendar day immediately after `now`. */
function tomorrowsDateKey(now: Date): string {
  const parts = getKolkataDateParts(now);
  const tomorrow = kolkataWallClockToUtc({ ...parts, day: parts.day + 1 }, 0, 0, 0);
  return todaysDateKey(tomorrow);
}

/** Whether Kolkata wall-clock time for `now` is at or after `hour`:00. */
function isKolkataTimeAtOrAfter(now: Date, hour: number): boolean {
  const parts = getKolkataDateParts(now);
  const threshold = kolkataWallClockToUtc(parts, hour, 0, 0);
  return now.getTime() >= threshold.getTime();
}

/**
 * The evening-before reminder's date/time trigger: `testDate` is tomorrow's
 * Kolkata calendar day, and it's already 19:00 or later, Kolkata wall-clock
 * time. `testDate` is the round's raw `test_date` ("YYYY-MM-DD" or null);
 * null (no date set yet) never fires, per 1.5.
 */
export function isEveningReminderDue(testDate: string | null, now: Date): boolean {
  if (!testDate) return false;
  return testDate === tomorrowsDateKey(now) && isKolkataTimeAtOrAfter(now, 19);
}

/**
 * The morning-of reminder's date/time trigger: `testDate` is today's
 * Kolkata calendar day, and it's already 09:00 or later, Kolkata wall-clock
 * time. Same null handling as `isEveningReminderDue`.
 */
export function isMorningReminderDue(testDate: string | null, now: Date): boolean {
  if (!testDate) return false;
  return testDate === todaysDateKey(now) && isKolkataTimeAtOrAfter(now, 9);
}
