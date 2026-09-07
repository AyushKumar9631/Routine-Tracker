"use server";

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

  const { data: activity, error } = await supabase
    .from("activities")
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      description: input.description.trim() || null,
      icon: input.icon.trim() || "\u2713",
      color: input.color || "#3F6B47",
      period: isLeetcode ? "daily" : input.period,
      schedule_day_of_week:
        !isLeetcode && (input.period === "weekly" || input.period === "biweekly")
          ? input.schedule_day_of_week
          : null,
      schedule_day_of_month:
        !isLeetcode && input.period === "monthly" ? input.schedule_day_of_month : null,
      anchor_date: !isLeetcode && input.period === "biweekly" ? input.anchor_date : null,
      completion_type: isLeetcode ? "boolean" : input.completion_type,
      target_value: !isLeetcode && input.completion_type === "count" ? input.target_value : null,
      unit_label:
        !isLeetcode && input.completion_type === "count" ? input.unit_label.trim() || null : null,
      is_automated: isLeetcode,
      automation_type: isLeetcode ? "leetcode_potd" : null,
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

  const { error } = await supabase
    .from("activities")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      icon: input.icon.trim() || "\u2713",
      color: input.color || "#3F6B47",
      period: isLeetcode ? "daily" : input.period,
      schedule_day_of_week:
        !isLeetcode && (input.period === "weekly" || input.period === "biweekly")
          ? input.schedule_day_of_week
          : null,
      schedule_day_of_month:
        !isLeetcode && input.period === "monthly" ? input.schedule_day_of_month : null,
      anchor_date: !isLeetcode && input.period === "biweekly" ? input.anchor_date : null,
      completion_type: isLeetcode ? "boolean" : input.completion_type,
      target_value: !isLeetcode && input.completion_type === "count" ? input.target_value : null,
      unit_label:
        !isLeetcode && input.completion_type === "count" ? input.unit_label.trim() || null : null,
      is_automated: isLeetcode,
      automation_type: isLeetcode ? "leetcode_potd" : null,
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
        { activity_id: id, user_id: user.id, leetcode_username: username },
        { onConflict: "activity_id" }
      );
    if (configError) throw new Error(configError.message);
  } else {
    await supabase.from("leetcode_potd_config").delete().eq("activity_id", id);
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
