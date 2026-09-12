export type Period = "daily" | "weekly" | "biweekly" | "monthly";
export type CompletionType = "boolean" | "count";

export interface Activity {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;

  period: Period;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
  anchor_date: string | null;

  completion_type: CompletionType;
  target_value: number | null;
  unit_label: string | null;

  is_automated: boolean;
  automation_type: string | null;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeetCodeConfig {
  id: string;
  activity_id: string;
  user_id: string;
  leetcode_username: string;
  preferred_complete_by: string | null; // "HH:MM:SS", Asia/Kolkata wall clock
  notification_template: string | null; // custom message; null = use the default
  last_notified_on: string | null; // date, set once a deadline notification has sent today
  last_checked_at: string | null;
  last_synced_date: string | null;
  last_question_slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface GfgConfig {
  id: string;
  activity_id: string;
  user_id: string;
  gfg_username: string;
  preferred_complete_by: string | null; // "HH:MM:SS", Asia/Kolkata wall clock
  notification_template: string | null; // custom message; null = use the default
  last_notified_on: string | null; // date, set once a deadline notification has sent today
  last_checked_at: string | null;
  last_known_streak: number | null;
  last_synced_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScreentimeConfig {
  id: string;
  activity_id: string;
  user_id: string;
  platform: "ios" | "android";
  token: string;
  last_synced_at: string | null;
  notify_90_template: string | null; // custom message; null = use the default
  notify_110_template: string | null;
  notify_150_template: string | null;
  last_notified_90_on: string | null; // date, set once that threshold's notification has sent today
  last_notified_110_on: string | null;
  last_notified_150_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface Completion {
  id: string;
  activity_id: string;
  user_id: string;
  period_key: string;
  value: number | null;
  completed: boolean;
  note: string | null;
  logged_at: string;
  created_at: string;
}

export interface ActivityFormInput {
  name: string;
  description: string;
  icon: string;
  color: string;
  period: Period;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
  anchor_date: string | null;
  completion_type: CompletionType;
  target_value: number | null;
  unit_label: string;

  automation_type: "none" | "leetcode_potd" | "gfg_potd" | "screen_time";
  leetcode_username: string;
  preferred_complete_by: string | null; // "HH:MM" from a <input type="time">, LeetCode + GFG
  notification_template: string | null; // LeetCode + GFG; null = use the default
  gfg_username: string;
  screentime_platform: "ios" | "android" | null;
  screentime_notify_90_template: string | null; // null = use the default
  screentime_notify_110_template: string | null;
  screentime_notify_150_template: string | null;
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
