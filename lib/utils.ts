import { clsx, type ClassValue } from "clsx";
import type { Activity, Completion } from "@/lib/types";
import { DAY_NAMES } from "@/lib/types";

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

export function todayKey(): string {
  return formatDateKey(new Date());
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
export function nextDueDate(activity: Activity, from: Date = new Date()): Date | null {
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 366; i++) {
    if (isDueOn(activity, cursor)) return new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
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
  const today = todayKey();
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

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
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
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
  };
}
