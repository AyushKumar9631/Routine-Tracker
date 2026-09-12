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
