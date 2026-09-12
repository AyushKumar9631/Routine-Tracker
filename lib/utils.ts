import { clsx, type ClassValue } from "clsx";
import type { Activity, ActivityFormInput, Completion } from "@/lib/types";
import { DAY_NAMES } from "@/lib/types";
import { todaysDateKey, getKolkataDateParts, kolkataWallClockToUtc } from "@/lib/deadlines";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format a Date as a local YYYY-MM-DD key (no timezone shifting). */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now: Date = new Date()): string {
  return todaysDateKey(now);
}

/**
 * Today's Asia/Kolkata calendar date, as a Date safe to read with local
 * getters (getDay, getDate, getMonth, getFullYear) — this stays correct
 * regardless of the server process's own timezone, unlike `new Date()`.
 */
export function kolkataToday(now: Date = new Date()): Date {
  return parseDateKey(todaysDateKey(now));
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Whether an activity's schedule lands on the given calendar date. */
export function isDueOn(activity: Activity, date: Date): boolean {
  switch (activity.period) {
    case "daily":
      return true;
    case "weekly":
      return date.getDay() === activity.schedule_day_of_week;
    case "biweekly": {
      if (date.getDay() !== activity.schedule_day_of_week) return false;
      if (!activity.anchor_date) return false;
      const anchor = parseDateKey(activity.anchor_date);
      const weeks = Math.round(
        (startOfWeek(date).getTime() - startOfWeek(anchor).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      return weeks % 2 === 0;
    }
    case "monthly": {
      const target = activity.schedule_day_of_month ?? 1;
      const lastDay = daysInMonth(date.getFullYear(), date.getMonth());
      const effectiveTarget = Math.min(target, lastDay);
      return date.getDate() === effectiveTarget;
    }
    default:
      return false;
  }
}

/** Next upcoming due date (today counts if due), searching up to a year out. */
export function nextDueDate(activity: Activity, from: Date = kolkataToday()): Date | null {
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 366; i++) {
    if (isDueOn(activity, cursor)) return new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

/**
 * The deadline for the period-instance of `activity` due on `from`'s
 * Asia/Kolkata calendar date: midnight at the end of that day, Kolkata
 * wall-clock time. Applies to any period (not just daily) — whatever's due
 * today is due by tonight. Returns null if the activity isn't due at all.
 */
export function deadlineFor(activity: Activity, from: Date = new Date()): Date | null {
  const parts = getKolkataDateParts(from);
  if (!isDueOn(activity, new Date(parts.year, parts.month, parts.day))) return null;
  return kolkataWallClockToUtc({ ...parts, day: parts.day + 1 }, 0, 0, 0);
}

/** Milliseconds remaining until `deadlineFor(activity, from)`; null if not due on that date. */
export function msUntilDeadline(activity: Activity, from: Date = new Date()): number | null {
  const deadline = deadlineFor(activity, from);
  return deadline ? deadline.getTime() - from.getTime() : null;
}

export function scheduleLabel(activity: Activity): string {
  switch (activity.period) {
    case "daily":
      return "Every day";
    case "weekly":
      return `Weekly \u00b7 ${DAY_NAMES[activity.schedule_day_of_week ?? 0]}`;
    case "biweekly":
      return `Biweekly \u00b7 ${DAY_NAMES[activity.schedule_day_of_week ?? 0]}`;
    case "monthly":
      return `Monthly \u00b7 day ${activity.schedule_day_of_month ?? 1}`;
    default:
      return "";
  }
}

/** Consecutive completed periods ending at the most recent due date on or before today. */
export function calcStreak(activity: Activity, completions: Completion[]): number {
  const completedKeys = new Set(
    completions.filter((c) => c.completed).map((c) => c.period_key)
  );
  const cursor = kolkataToday();
  const today = formatDateKey(cursor);

  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    if (isDueOn(activity, cursor)) {
      const key = formatDateKey(cursor);
      if (completedKeys.has(key)) {
        streak++;
      } else if (key !== today) {
        break;
      }
      // if key === today and not completed yet, don't break — just don't count it
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** % of due periods completed within the last `days` days (including today). */
export function calcCompletionRate(
  activity: Activity,
  completions: Completion[],
  days = 30
): number {
  const completedKeys = new Set(
    completions.filter((c) => c.completed).map((c) => c.period_key)
  );
  const cursor = kolkataToday();
  cursor.setDate(cursor.getDate() - (days - 1));

  let due = 0;
  let done = 0;
  for (let i = 0; i < days; i++) {
    if (isDueOn(activity, cursor)) {
      due++;
      if (completedKeys.has(formatDateKey(cursor))) done++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return due === 0 ? 0 : Math.round((done / due) * 100);
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function defaultActivityForm(): import("@/lib/types").ActivityFormInput {
  return {
    name: "",
    description: "",
    icon: "\u2713",
    color: "#3F6B47",
    period: "daily",
    schedule_day_of_week: 1,
    schedule_day_of_month: 1,
    anchor_date: todayKey(),
    completion_type: "boolean",
    target_value: null,
    unit_label: "",
    automation_type: "none",
    leetcode_username: "",
    preferred_complete_by: null,
    notification_template: null,
    gfg_username: "",
    screentime_platform: null,
  };
}

export const LEETCODE_ICON_URL = "https://assets.leetcode.com/users/leetcode/avatar_1568224780.png";
export const GFG_ICON_URL = "https://media.geeksforgeeks.org/gfg-gg-logo.svg";

/** Whether an activity's icon field holds an image URL rather than an emoji/text glyph. */
export function isImageIcon(icon: string | null | undefined): boolean {
  if (!icon) return false;
  return /^(https?:|data:image\/)/i.test(icon.trim());
}

/** Field defaults that go with a given automation type/template — shared by the template picker and the automation dropdown so they can't drift apart. */
export function automationDefaults(
  automation_type: ActivityFormInput["automation_type"]
): Partial<ActivityFormInput> {
  if (automation_type === "none") return { automation_type };
  if (automation_type === "leetcode_potd") {
    return { automation_type, period: "daily", completion_type: "boolean", icon: LEETCODE_ICON_URL };
  }
  if (automation_type === "gfg_potd") {
    return { automation_type, period: "daily", completion_type: "boolean", icon: GFG_ICON_URL };
  }
  if (automation_type === "screen_time") {
    return {
      automation_type,
      period: "daily",
      completion_type: "count",
      unit_label: "min",
      target_value: null,
      screentime_platform: null,
    };
  }
  return { automation_type, period: "daily", completion_type: "boolean" };
}

/** Coarse "3h ago" / "2d ago" style label for sync timestamps. */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never synced yet";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
