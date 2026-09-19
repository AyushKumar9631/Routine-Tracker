// Pure helpers for the Study Timer automation — a live, user-started/
// stopped countdown from a daily minutes goal down to zero and into
// negative (overtime) until stopped. No DB/fetch here; see
// actions/study-timer.ts for the server side and
// components/study-timer-card.tsx for the live client tick.

export type StudyHeatmapLevel = "empty" | "low" | "mid" | "high";

/** 0% -> empty, <50% -> low, <90% -> mid, >=90% -> high. No goal set = always empty. */
export function studyHeatmapLevel(
  minutes: number | null | undefined,
  goalMinutes: number | null | undefined
): StudyHeatmapLevel {
  if (!minutes || minutes <= 0) return "empty";
  if (!goalMinutes || goalMinutes <= 0) return "empty";
  const pct = (minutes / goalMinutes) * 100;
  if (pct < 50) return "low";
  if (pct < 90) return "mid";
  return "high";
}

// The moss/amber/rust/line -> Tailwind classname mapping deliberately isn't
// here: tailwind.config.ts only scans app/**  and components/** for class
// names to keep, so a literal "bg-rust/60" etc. living in lib/ would get
// silently purged from the CSS build. See STUDY_LEVEL_CLASS in
// components/completion-heatmap.tsx instead.

/** Seconds elapsed in a live session, given its start; 0 while not running. */
export function liveElapsedSeconds(runningSince: string | null, now: number = Date.now()): number {
  if (!runningSince) return 0;
  return Math.max(0, (now - new Date(runningSince).getTime()) / 1000);
}

/**
 * "H:MM:SS" (or "M:SS" under an hour), signed — negative once past the goal
 * so overtime reads as e.g. "-12:04" rather than a confusing positive count
 * that looks like time still remaining.
 */
export function formatStudyClock(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.round(Math.abs(seconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${sign}${h}:${pad(m)}:${pad(s)}` : `${sign}${m}:${pad(s)}`;
}
