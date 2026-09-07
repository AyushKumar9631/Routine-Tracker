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
