import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchGfgProfile } from "@/lib/gfg";

function todayKeyIst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export interface GfgSyncResult {
  currentStreak: number;
  maxStreak: number | null;
  solvedToday: boolean;
  date: string;
}

/**
 * GFG only exposes a streak counter, not per-problem timestamps, so
 * "solved today" is inferred from the streak going up by exactly 1 since
 * the last check. A null `previousStreak` (first-ever check) just
 * establishes a baseline — there's no way to tell if an existing streak
 * reflects today's solve or an earlier one.
 */
export async function syncGfgActivity(
  supabase: SupabaseClient,
  activityId: string,
  userId: string,
  gfgUsername: string,
  previousStreak: number | null
): Promise<GfgSyncResult> {
  const { currentStreak, maxStreak } = await fetchGfgProfile(gfgUsername);
  const date = todayKeyIst();
  const solvedToday = previousStreak !== null && currentStreak === previousStreak + 1;

  const configUpdate: Record<string, unknown> = {
    last_checked_at: new Date().toISOString(),
    last_known_streak: currentStreak,
  };
  if (solvedToday) configUpdate.last_synced_date = date;

  await supabase.from("gfg_potd_config").update(configUpdate).eq("activity_id", activityId);

  if (solvedToday) {
    const { error } = await supabase.from("completions").upsert(
      {
        activity_id: activityId,
        user_id: userId,
        period_key: date,
        completed: true,
        value: null,
        note: `Auto-detected: GFG POTD streak increased to ${currentStreak}`,
        logged_at: new Date().toISOString(),
      },
      { onConflict: "activity_id,period_key" }
    );
    if (error) throw new Error(error.message);
  }

  return { currentStreak, maxStreak, solvedToday, date };
}
