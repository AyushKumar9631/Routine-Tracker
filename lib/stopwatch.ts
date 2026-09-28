import { formatDateKey, parseDateKey } from "@/lib/utils";

// Stopwatch usage is name-agnostic: a day counts if at least one stopwatch
// session was completed on it, whatever it was called.

/** Consecutive days with a completed session, ending today. An unused today doesn't break the run. */
export function calcStopwatchStreak(periodKeys: string[], todayDateKey: string): number {
  const used = new Set(periodKeys);
  const cursor = parseDateKey(todayDateKey);
  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    const key = formatDateKey(cursor);
    if (used.has(key)) {
      streak++;
    } else if (key !== todayDateKey) {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function stopwatchLast14Days(periodKeys: string[], todayDateKey: string) {
  const used = new Set(periodKeys);
  const cursor = parseDateKey(todayDateKey);
  cursor.setDate(cursor.getDate() - 13);

  const days: { key: string; done: boolean }[] = [];
  for (let i = 0; i < 14; i++) {
    const key = formatDateKey(cursor);
    days.push({ key, done: used.has(key) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
