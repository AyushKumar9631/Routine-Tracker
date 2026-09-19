"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StudyTimerConfig } from "@/lib/types";
import { todayKey } from "@/lib/utils";
import { sendNotification } from "@/lib/notify";
import { DEFAULT_STUDY_TIMER_NOTIFICATION_TEMPLATE, renderNotificationTemplate } from "@/lib/notification-template";

export async function getStudyTimerConfig(activityId: string): Promise<StudyTimerConfig | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("study_timer_config")
    .select("*")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();

  return data as StudyTimerConfig | null;
}

/**
 * Starts a live session, unless one is already running (idempotent — a
 * double click or two tabs open never resets an in-progress session's
 * start time). The day it's pinned to (`session_period_key`) is fixed here
 * and reused on Stop, even if the session runs past midnight.
 */
export async function startStudyTimer(activityId: string): Promise<StudyTimerConfig> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("study_timer_config")
    .select("*")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.running_since) {
    return existing as StudyTimerConfig;
  }

  const { data, error } = await supabase
    .from("study_timer_config")
    .upsert(
      {
        activity_id: activityId,
        user_id: user.id,
        running_since: new Date().toISOString(),
        session_period_key: todayKey(),
      },
      { onConflict: "activity_id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath(`/activities/${activityId}`);
  return data as StudyTimerConfig;
}

/**
 * Stops the live session (a no-op if nothing is running) and folds its
 * elapsed time into `completions.value` for `session_period_key`, on top
 * of whatever was already logged there from earlier sessions today.
 */
export async function stopStudyTimer(
  activityId: string
): Promise<{ totalMinutes: number; goalMinutes: number | null; completed: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: activity } = await supabase
    .from("activities")
    .select("target_value")
    .eq("id", activityId)
    .maybeSingle();
  const goalMinutes = (activity?.target_value as number | null) ?? null;

  const { data: config } = await supabase
    .from("study_timer_config")
    .select("*")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!config?.running_since || !config.session_period_key) {
    const { data: completion } = await supabase
      .from("completions")
      .select("value, completed")
      .eq("activity_id", activityId)
      .eq("period_key", todayKey())
      .maybeSingle();
    return {
      totalMinutes: (completion?.value as number | null) ?? 0,
      goalMinutes,
      completed: completion?.completed ?? false,
    };
  }

  const elapsedMinutes = (Date.now() - new Date(config.running_since).getTime()) / 60000;

  const { data: existingCompletion } = await supabase
    .from("completions")
    .select("value")
    .eq("activity_id", activityId)
    .eq("period_key", config.session_period_key)
    .maybeSingle();

  const totalMinutes = Math.round(((existingCompletion?.value ?? 0) + elapsedMinutes) * 100) / 100;
  const completed = goalMinutes != null ? totalMinutes >= goalMinutes : false;

  const { error: completionError } = await supabase.from("completions").upsert(
    {
      activity_id: activityId,
      user_id: user.id,
      period_key: config.session_period_key,
      value: totalMinutes,
      completed,
      logged_at: new Date().toISOString(),
    },
    { onConflict: "activity_id,period_key" }
  );
  if (completionError) throw new Error(completionError.message);

  const { error: configError } = await supabase
    .from("study_timer_config")
    .update({ running_since: null, session_period_key: null })
    .eq("activity_id", activityId)
    .eq("user_id", user.id);
  if (configError) throw new Error(configError.message);

  revalidatePath("/");
  revalidatePath(`/activities/${activityId}`);
  return { totalMinutes, goalMinutes, completed };
}

/**
 * Fired from the client the instant a live countdown crosses zero (see
 * components/study-timer-card.tsx) — pushes to the user's phone via the
 * same ntfy topic every other automation uses. Re-checks notify_on_goal
 * server-side as defense in depth even though the client already gates it.
 */
export async function notifyStudyGoalReached(activityId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const [{ data: config }, { data: activity }, { data: settings }] = await Promise.all([
    supabase
      .from("study_timer_config")
      .select("notify_on_goal, notification_template")
      .eq("activity_id", activityId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("activities").select("name, target_value").eq("id", activityId).maybeSingle(),
    supabase.from("notification_settings").select("ntfy_topic").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!config?.notify_on_goal) return false;
  if (!activity) return false;

  const topic = settings?.ntfy_topic;
  if (!topic) return false;

  const goalMinutes = (activity.target_value as number | null) ?? 0;
  const template = config.notification_template || DEFAULT_STUDY_TIMER_NOTIFICATION_TEMPLATE;
  const message = renderNotificationTemplate(template, {
    activity: activity.name as string,
    goal: String(goalMinutes),
    studied: String(goalMinutes),
  });

  return sendNotification(topic, "Study goal reached \u{1F3AF}", message);
}
