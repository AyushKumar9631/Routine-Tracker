export type Period = "daily" | "weekly" | "biweekly" | "monthly";
export type CompletionType = "boolean" | "count";
export type ActivityKind = "routine" | "recruitment";

export interface Activity {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;

  // "routine" = the existing period/completion-driven activities (including
  // automations). "recruitment" = a recruitment drive — see lib/recruitment.ts.
  // For kind = "recruitment", `period` and `completion_type` below are left at
  // their DB defaults purely to satisfy NOT NULL and must never be read by the
  // app; the real state lives in RecruitmentDetails/RecruitmentRound instead.
  kind: ActivityKind;

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

// --- Recruitment Tracker ---
// See lib/recruitment.ts for the pure state-machine helpers that operate on
// these, and the plan doc (section 1.4) for the full state machine this
// mirrors. Field names match the recruitment_* tables from migration 014
// exactly — keep it that way rather than renaming on the way into the app.

export type RoundType = "oa" | "communication" | "technical" | "hr" | "other";
export type RoundResult = "awaiting" | "confident" | "not_sure" | "rejected" | "passed";
export type RecruitmentStatus = "active" | "done";
export type FinalOutcome = "offer" | "rejected" | "withdrawn";
export type InsightKind = "company_overview" | "round_prep";
export type InsightStatus = "pending" | "ready" | "failed";
export type ChatRole = "user" | "assistant";

export interface RecruitmentDetails {
  activity_id: string;
  user_id: string;
  company_name: string;
  company_url: string | null;
  role: string;
  status: RecruitmentStatus;
  final_outcome: FinalOutcome | null;
  created_at: string;
  updated_at: string;
}

export interface RecruitmentRound {
  id: string;
  activity_id: string;
  user_id: string;
  round_no: number;
  round_type: RoundType;
  test_date: string | null; // "YYYY-MM-DD"; null = not set yet, ask on Today
  result: RoundResult;
  notified_evening_sent: boolean;
  notified_morning_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecruitmentAiInsight {
  id: string;
  activity_id: string;
  round_id: string | null; // null = company-level (AI pass 1)
  user_id: string;
  kind: InsightKind;
  status: InsightStatus;
  content: unknown | null; // shape depends on `kind`; parsed JSON from the model
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecruitmentChatMessage {
  id: string;
  activity_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
}

/**
 * Shape of the recruitment creation form — deliberately separate from
 * ActivityFormInput (recruitment activities skip period/completion_type
 * entirely) and from RecruitmentDetails/RecruitmentRound (those are DB row
 * shapes; this is just what round 1 needs at creation time).
 */
export interface RecruitmentFormInput {
  company_name: string;
  company_url: string;
  role: string;
  round_type: RoundType;
  test_date: string; // "" = not set yet; else "YYYY-MM-DD" from <input type="date">
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
