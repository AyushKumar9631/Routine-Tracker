"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncLeetcodeActivity } from "@/lib/leetcode-sync";

export async function getLeetcodeUsername(activityId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("leetcode_potd_config")
    .select("leetcode_username")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.leetcode_username ?? "";
}

export async function syncLeetcodePotdNow(activityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: config, error: configError } = await supabase
    .from("leetcode_potd_config")
    .select("leetcode_username")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .single();

  if (configError || !config) {
    throw new Error("No LeetCode username configured for this activity");
  }

  const result = await syncLeetcodeActivity(supabase, activityId, user.id, config.leetcode_username);

  revalidatePath("/");
  revalidatePath(`/activities/${activityId}`);

  return result;
}
