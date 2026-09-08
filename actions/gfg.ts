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

export type GfgSyncOutcome =
  | ({ ok: true } & Awaited<ReturnType<typeof syncGfgActivity>>)
  | { ok: false; error: string };

/**
 * Next.js redacts any error that escapes a Server Action in production
 * ("An error occurred in the Server Components render..." + a digest,
 * with the real message stripped). syncGfgActivity throws on every
 * expected failure mode (no config, GFG fetch non-200, markup/streak not
 * found, DB upsert failure) so letting those propagate meant the button
 * could only ever show that generic digest message instead of the real
 * reason. Catch everything here and return it as data instead.
 */
export async function syncGfgPotdNow(activityId: string): Promise<GfgSyncOutcome> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { data: config, error: configError } = await supabase
      .from("gfg_potd_config")
      .select("gfg_username, last_known_streak")
      .eq("activity_id", activityId)
      .eq("user_id", user.id)
      .single();

    if (configError || !config) {
      return { ok: false, error: "No GFG username configured for this activity" };
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

    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed" };
  }
}
