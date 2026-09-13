// Reminder-due notify check for recruitment drives. Called by pg_cron (see
// 015_pg_cron_recruitment_notify.sql, task E3) with the round_ids SQL has
// already found *some* evening-or-morning reminder due for. This route
// re-derives, per round, exactly which reminder(s) actually apply right now
// (lib/recruitment-notify.ts) plus the notified_*_sent / result checks from
// plan 1.5 — a defense-in-depth re-check rather than trusting the gate
// blindly, same spirit as the explicit .eq("user_id", ...) filters already
// used elsewhere in this feature — then sends + flips the matching
// notified_*_sent boolean. Unlike the LeetCode/GFG jobs there's no external
// state to sync first; the DB row is the whole truth here.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification } from "@/lib/notify";
import {
  DEFAULT_RECRUITMENT_EVENING_TEMPLATE,
  DEFAULT_RECRUITMENT_MORNING_TEMPLATE,
  renderNotificationTemplate,
} from "@/lib/notification-template";
import { isEveningReminderDue, isMorningReminderDue } from "@/lib/recruitment-notify";
import { ROUND_TYPE_LABELS } from "@/lib/recruitment";
import type { RecruitmentRound } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ReminderKind = "evening" | "morning";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roundIds =
    new URL(request.url).searchParams.get("round_ids")?.split(",").filter(Boolean) ?? [];
  if (roundIds.length === 0) {
    return NextResponse.json({ checked: 0, results: [] });
  }

  const supabase = createAdminClient();
  const now = new Date();

  const { data: roundsData, error: roundsError } = await supabase
    .from("recruitment_rounds")
    .select("*")
    .in("id", roundIds);
  if (roundsError) {
    return NextResponse.json({ error: roundsError.message }, { status: 500 });
  }
  const rounds = (roundsData ?? []) as RecruitmentRound[];

  const activityIds = [...new Set(rounds.map((r) => r.activity_id))];
  const { data: detailsData, error: detailsError } = await supabase
    .from("recruitment_details")
    .select("activity_id, user_id, company_name, role")
    .in("activity_id", activityIds);
  if (detailsError) {
    return NextResponse.json({ error: detailsError.message }, { status: 500 });
  }
  type DriveInfo = { activity_id: string; user_id: string; company_name: string; role: string };
  const detailsByActivity = new Map(
    ((detailsData ?? []) as DriveInfo[]).map((d) => [d.activity_id, d])
  );

  const userIds = [...new Set([...detailsByActivity.values()].map((d) => d.user_id))];
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
      .map((s) => [s.user_id as string, s.ntfy_topic as string])
  );

  const results = await Promise.all(
    rounds.map(async (round) => {
      const details = detailsByActivity.get(round.activity_id);
      if (!details) {
        return { round_id: round.id, skipped: "no matching recruitment_details" };
      }

      // Which reminder(s) are actually due right now, per plan 1.5 in full
      // (date/time trigger + not-yet-sent + still awaiting) — the SQL gate
      // only confirms *something* in the batch is due, not which kind for
      // this specific round, and this also guards a stale/duplicate tick.
      const due: { kind: ReminderKind; template: string; title: string }[] = [];
      if (
        round.result === "awaiting" &&
        !round.notified_evening_sent &&
        isEveningReminderDue(round.test_date, now)
      ) {
        due.push({
          kind: "evening",
          template: DEFAULT_RECRUITMENT_EVENING_TEMPLATE,
          title: "Prepare for tomorrow's test",
        });
      }
      if (
        round.result === "awaiting" &&
        !round.notified_morning_sent &&
        isMorningReminderDue(round.test_date, now)
      ) {
        due.push({
          kind: "morning",
          template: DEFAULT_RECRUITMENT_MORNING_TEMPLATE,
          title: "Today's the test",
        });
      }

      if (due.length === 0) {
        return { round_id: round.id, skipped: "not due" };
      }

      const topic = topicByUser.get(details.user_id);
      if (!topic) {
        return { round_id: round.id, skipped: "no notification channel connected" };
      }

      const notified: ReminderKind[] = [];
      for (const reminder of due) {
        const message = renderNotificationTemplate(reminder.template, {
          company: details.company_name,
          role: details.role,
          round_type: ROUND_TYPE_LABELS[round.round_type],
        });

        const sent = await sendNotification(topic, reminder.title, message);
        if (!sent) continue;

        const updateField: keyof RecruitmentRound =
          reminder.kind === "evening" ? "notified_evening_sent" : "notified_morning_sent";
        const { error: updateError } = await supabase
          .from("recruitment_rounds")
          .update({ [updateField]: true })
          .eq("id", round.id)
          .eq("user_id", details.user_id);

        if (!updateError) notified.push(reminder.kind);
      }

      return { round_id: round.id, notified };
    })
  );

  return NextResponse.json({ checked: results.length, results });
}
