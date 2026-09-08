"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncGfgActivity } from "@/lib/gfg-sync";

export async function getGfgUsername(activityId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("gfg_potd_config")
    .select("gfg_username")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.gfg_username ?? "";
}

export async function syncGfgPotdNow(activityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: config, error: configError } = await supabase
    .from("gfg_potd_config")
    .select("gfg_username, last_known_streak")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .single();

  if (configError || !config) {
    throw new Error("No GFG username configured for this activity");
  }

  const result = await syncGfgActivity(
    supabase,
    activityId,
    user.id,
    config.gfg_username,
    config.last_known_streak
  );

  revalidatePath("/");
  revalidatePath(`/activities/${activityId}`);

  return result;
}
