// Deadline-approaching notify check for LeetCode POTD. Runs every 5 minutes
// via pg_cron (see 007_pg_cron_leetcode_notify.sql) — separate from
// leetcode-potd-sync, which detects a solve any time of day. This route's
// only job is: once we're past the user's threshold and it's still
// unsolved, call LeetCode and, if still unsolved, notify — exactly once
// per day. See leetcode-deadline-notification-plan.md for the full spec.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLeetcodeActivity } from "@/lib/leetcode-sync";
import { sendNotification } from "@/lib/notify";
import { todaysDateKey, todaysNotifyThreshold } from "@/lib/deadlines";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const todayKey = todaysDateKey(now);

  const { data: activeActivities, error: activitiesError } = await supabase
    .from("activities")
    .select("id, user_id")
    .eq("automation_type", "leetcode_potd")
    .eq("is_active", true);

  if (activitiesError) {
    return NextResponse.json({ error: activitiesError.message }, { status: 500 });
  }
  if (!activeActivities || activeActivities.length === 0) {
    return NextResponse.json({ checked: 0, results: [] });
  }

  const activityIds = activeActivities.map((a) => a.id);
  const userByActivity = new Map(activeActivities.map((a) => [a.id, a.user_id]));

  const { data: configs, error: configError } = await supabase
    .from("leetcode_potd_config")
    .select("activity_id, leetcode_username, preferred_complete_by, last_notified_on")
    .in("activity_id", activityIds);

  if (configError) {
    return NextResponse.json({ error: configError.message }, { status: 500 });
  }

  // Completions are keyed to the Kolkata calendar day, matching the
  // deadline (also Kolkata midnight). LeetCode's own POTD date is UTC and
  // can lag the Kolkata date by up to ~5.5h overnight, but that window
  // always falls before the notify threshold below, so it never affects
  // the decision that actually matters (the one made near the deadline).
  const { data: todaysCompletions, error: completionsError } = await supabase
    .from("completions")
    .select("activity_id, completed")
    .eq("period_key", todayKey)
    .in("activity_id", activityIds);

  if (completionsError) {
    return NextResponse.json({ error: completionsError.message }, { status: 500 });
  }

  const completedToday = new Set(
    (todaysCompletions ?? []).filter((c) => c.completed).map((c) => c.activity_id)
  );

  // Per-user topic, not a single shared NTFY_TOPIC_URL — each user connects
  // their own from the nav bar (see actions/notifications.ts).
  const userIds = [...new Set(activeActivities.map((a) => a.user_id))];
  const { data: notificationSettings, error: notificationSettingsError } = await supabase
    .from("notification_settings")
    .select("user_id, ntfy_topic")
    .in("user_id", userIds);

  if (notificationSettingsError) {
    return NextResponse.json({ error: notificationSettingsError.message }, { status: 500 });
  }

  const topicByUser = new Map(
    (notificationSettings ?? [])
      .filter((s) => s.ntfy_topic)
      .map((s) => [s.user_id, s.ntfy_topic as string])
  );

  const results = await Promise.all(
    (configs ?? []).map(async (cfg) => {
      const activityId = cfg.activity_id as string;
      const userId = userByActivity.get(activityId);
      if (!userId) return { activity_id: activityId, skipped: "no matching activity" };

      // 1. Already completed today locally? Nothing to do, no API call.
      if (completedToday.has(activityId)) {
        return { activity_id: activityId, skipped: "already completed today" };
      }

      // 2. Before today's notify threshold? Leave it alone (the "it's 2am" case).
      const threshold = todaysNotifyThreshold(
        now,
        cfg.preferred_complete_by as string | null
      );
      if (now.getTime() < threshold.getTime()) {
        return { activity_id: activityId, skipped: "before notify threshold" };
      }

      // 3. Already notified today? Don't resend, don't re-hit LeetCode.
      if (cfg.last_notified_on === todayKey) {
        return { activity_id: activityId, skipped: "already notified today" };
      }

      // 4. Past threshold, unsolved locally, not yet notified — check LeetCode.
      try {
        const result = await syncLeetcodeActivity(
          supabase,
          activityId,
          userId,
          cfg.leetcode_username as string
        );

        if (result.solved) {
          // syncLeetcodeActivity already upserted the completion.
          return { activity_id: activityId, solved: true };
        }

        // Still unsolved past the threshold. Notify only if this user has
        // connected a topic — otherwise there's nowhere to send it, so skip
        // without touching last_notified_on (nothing was actually sent).
        const topic = topicByUser.get(userId);
        if (!topic) {
          return { activity_id: activityId, skipped: "no notification channel connected" };
        }

        const sent = await sendNotification(
          topic,
          "LeetCode POTD deadline approaching",
          `"${result.title}" is still unsolved — deadline is midnight tonight.`
        );

        if (!sent) {
          return { activity_id: activityId, notified: false, error: "notification send failed" };
        }

        // Only record the send after it's confirmed successful.
        const { error: updateError } = await supabase
          .from("leetcode_potd_config")
          .update({ last_notified_on: todayKey })
          .eq("activity_id", activityId);

        if (updateError) {
          return {
            activity_id: activityId,
            notified: true,
            warning: `sent, but failed to record last_notified_on: ${updateError.message}`,
          };
        }

        return { activity_id: activityId, notified: true };
      } catch (err) {
        return {
          activity_id: activityId,
          error: err instanceof Error ? err.message : "check failed",
        };
      }
    })
  );

  return NextResponse.json({ checked: results.length, results });
}
