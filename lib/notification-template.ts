// Renders the user-customizable LeetCode deadline notification. Pure string
// substitution — no DB/fetch here — so it's trivial to preview or test on
// its own.

export const DEFAULT_NOTIFICATION_TEMPLATE =
  '"{question}" is still unsolved — deadline is midnight tonight.';

export interface NotificationTemplateVars {
  question: string; // the POTD's title, e.g. "Longest Substring Without Repeating Characters"
  number: string; // LeetCode's question number, e.g. "3"
  difficulty: string; // "Easy" | "Medium" | "Hard"
}

/**
 * Fills in {question}, {number}, {difficulty} placeholders in a
 * user-supplied template. Unrecognized placeholders are left as-is rather
 * than stripped, so a typo in a custom template doesn't silently eat text.
 */
export function renderNotificationTemplate(
  template: string,
  vars: NotificationTemplateVars
): string {
  return template
    .replaceAll("{question}", vars.question)
    .replaceAll("{number}", vars.number)
    .replaceAll("{difficulty}", vars.difficulty);
}
