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

  const { error } = await supabase.from("activities").insert({
    user_id: user.id,
    name: input.name.trim(),
    description: input.description.trim() || null,
    icon: input.icon.trim() || "\u2713",
    color: input.color || "#3F6B47",
    period: input.period,
    schedule_day_of_week:
      input.period === "weekly" || input.period === "biweekly"
        ? input.schedule_day_of_week
        : null,
    schedule_day_of_month: input.period === "monthly" ? input.schedule_day_of_month : null,
    anchor_date: input.period === "biweekly" ? input.anchor_date : null,
    completion_type: input.completion_type,
    target_value: input.completion_type === "count" ? input.target_value : null,
    unit_label: input.completion_type === "count" ? input.unit_label.trim() || null : null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/activities");
}

export async function updateActivity(id: string, input: ActivityFormInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("activities")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      icon: input.icon.trim() || "\u2713",
      color: input.color || "#3F6B47",
      period: input.period,
      schedule_day_of_week:
        input.period === "weekly" || input.period === "biweekly"
          ? input.schedule_day_of_week
          : null,
      schedule_day_of_month: input.period === "monthly" ? input.schedule_day_of_month : null,
      anchor_date: input.period === "biweekly" ? input.anchor_date : null,
      completion_type: input.completion_type,
      target_value: input.completion_type === "count" ? input.target_value : null,
      unit_label: input.completion_type === "count" ? input.unit_label.trim() || null : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
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
