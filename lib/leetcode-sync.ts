import type { SupabaseClient } from "@supabase/supabase-js";
import { checkLeetCodePotd, type LeetCodePotdResult } from "@/lib/leetcode";

/**
 * Checks LeetCode for `leetcodeUsername`, updates the sync cursor on
 * leetcode_potd_config, and — only when solved — upserts a completions row.
 * Never writes `completed: false`, so it never clobbers a manual override.
 */
export async function syncLeetcodeActivity(
  supabase: SupabaseClient,
  activityId: string,
  userId: string,
  leetcodeUsername: string
): Promise<LeetCodePotdResult> {
  const result = await checkLeetCodePotd(leetcodeUsername);

  const configUpdate: Record<string, unknown> = {
    last_checked_at: new Date().toISOString(),
    last_question_slug: result.titleSlug,
  };
  if (result.solved) configUpdate.last_synced_date = result.date;

  await supabase.from("leetcode_potd_config").update(configUpdate).eq("activity_id", activityId);

  if (result.solved) {
    const { error } = await supabase.from("completions").upsert(
      {
        activity_id: activityId,
        user_id: userId,
        period_key: result.date,
        completed: true,
        value: null,
        note: `Auto-detected: solved "${result.title}" on LeetCode`,
        logged_at: new Date().toISOString(),
      },
      { onConflict: "activity_id,period_key" }
    );
    if (error) throw new Error(error.message);
  }

  return result;
}
