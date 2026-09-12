"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActivityFormInput } from "@/lib/types";

export async function createActivity(input: ActivityFormInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const isLeetcode = input.automation_type === "leetcode_potd";
  const isGfg = input.automation_type === "gfg_potd";
  const isScreenTime = input.automation_type === "screen_time";
  const isAutomated = isLeetcode || isGfg || isScreenTime;

  if (isScreenTime && input.screentime_platform === "android") {
    throw new Error("Android screen time automation isn't available yet");
  }
  if (isScreenTime && input.screentime_platform !== "ios") {
    throw new Error("Choose a phone to set up screen time tracking");
  }

  const { data: activity, error } = await supabase
    .from("activities")
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      description: input.description.trim() || null,
      icon: input.icon.trim() || "\u2713",
      color: input.color || "#3F6B47",
      period: isAutomated ? "daily" : input.period,
      schedule_day_of_week:
        !isAutomated && (input.period === "weekly" || input.period === "biweekly")
          ? input.schedule_day_of_week
          : null,
      schedule_day_of_month:
        !isAutomated && input.period === "monthly" ? input.schedule_day_of_month : null,
      anchor_date: !isAutomated && input.period === "biweekly" ? input.anchor_date : null,
      completion_type: isScreenTime ? "count" : isAutomated ? "boolean" : input.completion_type,
      target_value: isScreenTime
        ? input.target_value
        : !isAutomated && input.completion_type === "count"
        ? input.target_value
        : null,
      unit_label: isScreenTime
        ? "min"
        : !isAutomated && input.completion_type === "count"
        ? input.unit_label.trim() || null
        : null,
      is_automated: isAutomated,
      automation_type: isAutomated ? input.automation_type : null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (isLeetcode) {
    const username = input.leetcode_username.trim();
    if (!username) throw new Error("LeetCode username is required");
    const { error: configError } = await supabase.from("leetcode_potd_config").insert({
      activity_id: activity.id,
      user_id: user.id,
      leetcode_username: username,
      preferred_complete_by: input.preferred_complete_by || null,
      notification_template: input.notification_template || null,
    });
    if (configError) throw new Error(configError.message);
  } else if (isGfg) {
    const username = input.gfg_username.trim();
    if (!username) throw new Error("GFG username is required");
    const { error: configError } = await supabase.from("gfg_potd_config").insert({
      activity_id: activity.id,
      user_id: user.id,
      gfg_username: username,
    });
    if (configError) throw new Error(configError.message);
  } else if (isScreenTime) {
    const token = randomBytes(24).toString("hex");
    const { error: configError } = await supabase.from("screentime_config").insert({
      activity_id: activity.id,
      user_id: user.id,
      platform: "ios",
      token,
    });
    if (configError) throw new Error(configError.message);
  }

  revalidatePath("/");
  revalidatePath("/activities");
}

export async function updateActivity(id: string, input: ActivityFormInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const isLeetcode = input.automation_type === "leetcode_potd";
  const isGfg = input.automation_type === "gfg_potd";
  const isScreenTime = input.automation_type === "screen_time";
  const isAutomated = isLeetcode || isGfg || isScreenTime;

  if (isScreenTime && input.screentime_platform === "android") {
    throw new Error("Android screen time automation isn't available yet");
  }
  if (isScreenTime && input.screentime_platform !== "ios") {
    throw new Error("Choose a phone to set up screen time tracking");
  }

  const { error } = await supabase
    .from("activities")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      icon: input.icon.trim() || "\u2713",
      color: input.color || "#3F6B47",
      period: isAutomated ? "daily" : input.period,
      schedule_day_of_week:
        !isAutomated && (input.period === "weekly" || input.period === "biweekly")
          ? input.schedule_day_of_week
          : null,
      schedule_day_of_month:
        !isAutomated && input.period === "monthly" ? input.schedule_day_of_month : null,
      anchor_date: !isAutomated && input.period === "biweekly" ? input.anchor_date : null,
      completion_type: isScreenTime ? "count" : isAutomated ? "boolean" : input.completion_type,
      target_value: isScreenTime
        ? input.target_value
        : !isAutomated && input.completion_type === "count"
        ? input.target_value
        : null,
      unit_label: isScreenTime
        ? "min"
        : !isAutomated && input.completion_type === "count"
        ? input.unit_label.trim() || null
        : null,
      is_automated: isAutomated,
      automation_type: isAutomated ? input.automation_type : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  if (isLeetcode) {
    const username = input.leetcode_username.trim();
    if (!username) throw new Error("LeetCode username is required");
    const { error: configError } = await supabase
      .from("leetcode_potd_config")
      .upsert(
        {
          activity_id: id,
          user_id: user.id,
          leetcode_username: username,
          preferred_complete_by: input.preferred_complete_by || null,
          notification_template: input.notification_template || null,
        },
        { onConflict: "activity_id" }
      );
    if (configError) throw new Error(configError.message);
    await supabase.from("gfg_potd_config").delete().eq("activity_id", id);
    await supabase.from("screentime_config").delete().eq("activity_id", id);
  } else if (isGfg) {
    const username = input.gfg_username.trim();
    if (!username) throw new Error("GFG username is required");
    const { error: configError } = await supabase
      .from("gfg_potd_config")
      .upsert(
        { activity_id: id, user_id: user.id, gfg_username: username },
        { onConflict: "activity_id" }
      );
    if (configError) throw new Error(configError.message);
    await supabase.from("leetcode_potd_config").delete().eq("activity_id", id);
    await supabase.from("screentime_config").delete().eq("activity_id", id);
  } else if (isScreenTime) {
    // Preserve the existing token on edit — the webhook URL must stay
    // stable, or the user's already-built Shortcut silently breaks.
    const { data: existing } = await supabase
      .from("screentime_config")
      .select("id")
      .eq("activity_id", id)
      .maybeSingle();
    if (!existing) {
      const token = randomBytes(24).toString("hex");
      const { error: configError } = await supabase.from("screentime_config").insert({
        activity_id: id,
        user_id: user.id,
        platform: "ios",
        token,
      });
      if (configError) throw new Error(configError.message);
    }
    await supabase.from("leetcode_potd_config").delete().eq("activity_id", id);
    await supabase.from("gfg_potd_config").delete().eq("activity_id", id);
  } else {
    await supabase.from("leetcode_potd_config").delete().eq("activity_id", id);
    await supabase.from("gfg_potd_config").delete().eq("activity_id", id);
    await supabase.from("screentime_config").delete().eq("activity_id", id);
  }

  revalidatePath("/");
  revalidatePath("/activities");
  revalidatePath(`/activities/${id}`);
}

export async function deleteActivity(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("activities").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/activities");
}

export async function toggleActivityActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("activities")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/activities");
}
