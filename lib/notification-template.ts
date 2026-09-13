// Renders the user-customizable LeetCode deadline notification. Pure string
// substitution — no DB/fetch here — so it's trivial to preview or test on
// its own.

export const DEFAULT_NOTIFICATION_TEMPLATE =
  '"{question}" is still unsolved — deadline is midnight tonight.';

// GFG's public API doesn't expose the POTD's title/difficulty/number (see
// lib/gfg.ts) — only a streak counter — so there's no {question}-equivalent
// placeholder available here. {streak} is the one piece of real data we
// have at notify-time.
export const DEFAULT_GFG_NOTIFICATION_TEMPLATE =
  "Today's GFG POTD is still unsolved — deadline is midnight tonight. Current streak: {streak}.";

export interface NotificationTemplateVars {
  question: string; // the POTD's title, e.g. "Longest Substring Without Repeating Characters"
  number: string; // LeetCode's question number, e.g. "3"
  difficulty: string; // "Easy" | "Medium" | "Hard"
}

export interface GfgNotificationTemplateVars {
  streak: string; // current streak count observed at check time
}

// Screen time has no deadline-check job — the three thresholds below fire
// straight out of the ingest webhook (see lib/screentime.ts +
// app/api/screentime/[token]/route.ts), each at most once per day.
export type ScreenTimeNotifyThreshold = 90 | 110 | 150;

export interface ScreenTimeNotificationTemplateVars {
  minutes: string; // total minutes logged today
  limit: string; // the activity's daily budget, in minutes
  percent: string; // rounded % of budget used
}

export const DEFAULT_SCREENTIME_NOTIFICATION_TEMPLATES: Record<ScreenTimeNotifyThreshold, string> = {
  90: "Screen time is at {percent}% of today's {limit}-min budget ({minutes} min so far).",
  110: "Screen time budget exceeded \u2014 {percent}% used ({minutes}/{limit} min).",
  150: "Screen time is way past budget: {percent}% used ({minutes}/{limit} min). Time to put the phone down.",
};

// Recruitment reminders (see lib/recruitment-notify.ts + the pg_cron notify
// job) have exactly two fixed variants, evening-before and morning-of — a
// round has no notification_template column of its own the way LeetCode/GFG
// configs do, so there's nothing per-user to fall back from here.
export interface RecruitmentNotificationTemplateVars {
  company: string; // recruitment_details.company_name
  role: string; // recruitment_details.role
  round_type: string; // ROUND_TYPE_LABELS[round.round_type], e.g. "Technical"
}

export const DEFAULT_RECRUITMENT_EVENING_TEMPLATE =
  "Your {round_type} round with {company} ({role}) is tomorrow \u2014 get ready.";
export const DEFAULT_RECRUITMENT_MORNING_TEMPLATE =
  "Today's the day: {round_type} round with {company} ({role}). Good luck!";

/**
 * Fills in `{key}` placeholders in a user-supplied template from a vars
 * object. Unrecognized placeholders are left as-is rather than stripped, so
 * a typo in a custom template doesn't silently eat text. Generic over the
 * vars shape so both LeetCode's {question}/{number}/{difficulty} and GFG's
 * {streak} templates share this one implementation.
 */
export function renderNotificationTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return Object.entries(vars).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, value),
    template
  );
}
