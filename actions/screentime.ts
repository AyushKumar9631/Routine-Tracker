"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ScreentimeConfig } from "@/lib/types";

export async function getScreentimeConfig(activityId: string): Promise<ScreentimeConfig | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("screentime_config")
    .select("*")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();

  return data as ScreentimeConfig | null;
}

/** Rotates the webhook token — the old URL stops working immediately. */
export async function regenerateScreentimeToken(activityId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const token = randomBytes(24).toString("hex");
  const { error } = await supabase
    .from("screentime_config")
    .update({ token })
    .eq("activity_id", activityId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/activities/${activityId}`);
  return token;
}
