// Jomo's "Get Screentime" Shortcuts action returns a formatted duration
// string (e.g. "3h 24m", "45m", "1h") rather than a raw number, and users
// may wire the Shortcut's "Get Contents of URL" body differently, so the
// webhook has to accept either a plain minutes value or that string format.

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
