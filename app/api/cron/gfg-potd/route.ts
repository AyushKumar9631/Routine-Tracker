// Deadline-approaching notify check for GFG POTD. Called by pg_cron (see
// 012_pg_cron_gfg_notify.sql) only when SQL has already confirmed, per
// activity_id, that it's unsolved-locally + past threshold + not yet
// notified today — this route no longer re-checks any of that. Its only
// job per activity_id it's given: check GFG, and if still unsolved,
// notify + mark last_notified_on.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGfgActivity } from "@/lib/gfg-sync";
import { sendNotification } from "@/lib/notify";
import { DEFAULT_GFG_NOTIFICATION_TEMPLATE, renderNotificationTemplate } from "@/lib/notification-template";
import { todaysDateKey } from "@/lib/deadlines";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activityIds =
    new URL(request.url).searchParams.get("activity_ids")?.split(",").filter(Boolean) ?? [];
  if (activityIds.length === 0) {
    return NextResponse.json({ checked: 0, results: [] });
  }

  const supabase = createAdminClient();
  const todayKey = todaysDateKey();

  // user_id lives on gfg_potd_config directly, so no activities join is
  // needed here (same as leetcode_potd_config in leetcode-notify).
  const { data: configs, error: configError } = await supabase
    .from("gfg_potd_config")
    .select("activity_id, user_id, gfg_username, last_known_streak, notification_template")
    .in("activity_id", activityIds);

  if (configError) {
    return NextResponse.json({ error: configError.message }, { status: 500 });
  }

  const userIds = [...new Set((configs ?? []).map((c) => c.user_id as string))];
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
      const userId = cfg.user_id as string;

      try {
        // The one check this route still does: is it actually solved?
        const result = await syncGfgActivity(
          supabase,
          activityId,
          userId,
          cfg.gfg_username as string,
          cfg.last_known_streak as number | null
        );

        if (result.solvedToday) {
          // syncGfgActivity already upserted the completion.
          return { activity_id: activityId, solved: true };
        }

        const topic = topicByUser.get(userId);
        if (!topic) {
          return { activity_id: activityId, skipped: "no notification channel connected" };
        }

        const message = renderNotificationTemplate(
          (cfg.notification_template as string | null) || DEFAULT_GFG_NOTIFICATION_TEMPLATE,
          { streak: String(result.currentStreak) }
        );

        const sent = await sendNotification(topic, "GFG POTD deadline approaching", message);
        if (!sent) {
          return { activity_id: activityId, notified: false, error: "notification send failed" };
        }

        const { error: updateError } = await supabase
          .from("gfg_potd_config")
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
