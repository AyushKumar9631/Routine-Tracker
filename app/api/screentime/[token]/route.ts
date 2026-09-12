import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractScreenTimeValue, parseScreenTimeMinutes, reachedScreenTimeThresholds, SCREENTIME_NOTIFY_THRESHOLDS } from "@/lib/screentime";
import { todayKey } from "@/lib/utils";
import { sendNotification } from "@/lib/notify";
import { DEFAULT_SCREENTIME_NOTIFICATION_TEMPLATES, renderNotificationTemplate } from "@/lib/notification-template";

export const dynamic = "force-dynamic";

// Public route: no CRON_SECRET, no session — the per-activity token in the
// path IS the auth. Always resolve 200 on a request from a known token
// (even if the payload was unusable) so the iOS Shortcut never shows the
// user a failure for something it can't act on.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: config } = await supabase
    .from("screentime_config")
    .select(
      "id, activity_id, user_id, notify_90_template, notify_110_template, notify_150_template, last_notified_90_on, last_notified_110_on, last_notified_150_on"
    )
    .eq("token", token)
    .maybeSingle();

  if (!config) {
    return NextResponse.json({ error: "Unknown webhook token" }, { status: 404 });
  }

  const rawText = await request.text();
  let payload: unknown = rawText;
  try {
    payload = JSON.parse(rawText);
  } catch {
    // Not JSON — Shortcuts' "Get Contents of URL" can also send a plain
    // text body ("3h 24m") depending on how the user wired it up.
  }

  const extracted = extractScreenTimeValue(payload);
  const minutes = parseScreenTimeMinutes(extracted);

  // Temporary debug logging — check Vercel's function logs for this route to
  // see exactly what the Shortcut is sending. Safe to remove once the
  // parsing/value is confirmed correct; it only logs the screen-time value,
  // nothing sensitive.
  console.log("[screentime] raw body:", rawText.slice(0, 500));
  console.log("[screentime] extracted value:", extracted, "-> parsed minutes:", minutes);

  await supabase
    .from("screentime_config")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", config.id);

  if (minutes === null) {
    return NextResponse.json(
      { ok: false, reason: "unrecognized value", raw: rawText.slice(0, 200), extracted },
      { status: 200 }
    );
  }

  const today = todayKey();

  const { error } = await supabase.from("completions").upsert(
    {
      activity_id: config.activity_id,
      user_id: config.user_id,
      period_key: today,
      completed: true,
      value: minutes,
      note: null,
      logged_at: new Date().toISOString(),
    },
    { onConflict: "activity_id,period_key" }
  );

  if (error) {
    // Log server-side only — a Shortcut can't surface this to the user
    // usefully, and we already committed to returning 200.
    console.error("screentime ingest: completions upsert failed", error.message);
  }

  const notified = await checkAndSendBudgetNotifications(supabase, config, minutes, today);

  return NextResponse.json({ ok: true, minutes, raw: rawText.slice(0, 200), extracted, notified });
}

interface ScreentimeNotifyConfig {
  id: string;
  activity_id: string;
  user_id: string;
  notify_90_template: string | null;
  notify_110_template: string | null;
  notify_150_template: string | null;
  last_notified_90_on: string | null;
  last_notified_110_on: string | null;
  last_notified_150_on: string | null;
}

const NOTIFY_TEMPLATE_COLUMN = {
  90: "notify_90_template",
  110: "notify_110_template",
  150: "notify_150_template",
} as const;

const LAST_NOTIFIED_COLUMN = {
  90: "last_notified_90_on",
  110: "last_notified_110_on",
  150: "last_notified_150_on",
} as const;

/**
 * There's no cron for screen time (unlike LeetCode/GFG deadline notify) —
 * this runs inline off whichever sync (mid-day "app opened" or the
 * existing end-of-day one) crosses a threshold first. Each of the fixed
 * 90/110/150% thresholds fires at most once per calendar day, gated by its
 * own last_notified_*_on column so a later same-day sync that's still over
 * a threshold already sent today doesn't re-notify.
 */
async function checkAndSendBudgetNotifications(
  supabase: ReturnType<typeof createAdminClient>,
  config: ScreentimeNotifyConfig,
  minutes: number | null,
  today: string
): Promise<number[]> {
  if (minutes === null) return [];

  const { data: activity } = await supabase
    .from("activities")
    .select("target_value")
    .eq("id", config.activity_id)
    .maybeSingle();

  const limitMinutes = (activity?.target_value as number | null) ?? null;
  const reached = reachedScreenTimeThresholds(minutes, limitMinutes);
  const pending = reached.filter((t) => config[LAST_NOTIFIED_COLUMN[t]] !== today);
  if (pending.length === 0) return [];

  const { data: settings } = await supabase
    .from("notification_settings")
    .select("ntfy_topic")
    .eq("user_id", config.user_id)
    .maybeSingle();

  const topic = settings?.ntfy_topic;
  if (!topic) return [];

  const percent = String(Math.round((minutes / (limitMinutes as number)) * 100));
  const vars = { minutes: String(minutes), limit: String(limitMinutes), percent };

  const sent: (typeof SCREENTIME_NOTIFY_THRESHOLDS)[number][] = [];
  for (const threshold of pending) {
    const template = config[NOTIFY_TEMPLATE_COLUMN[threshold]] || DEFAULT_SCREENTIME_NOTIFICATION_TEMPLATES[threshold];
    const message = renderNotificationTemplate(template, vars);
    const ok = await sendNotification(topic, `Screen time at ${threshold}%`, message);
    if (ok) sent.push(threshold);
  }

  if (sent.length > 0) {
    const update = Object.fromEntries(sent.map((t) => [LAST_NOTIFIED_COLUMN[t], today]));
    const { error } = await supabase.from("screentime_config").update(update).eq("id", config.id);
    if (error) {
      console.error("screentime ingest: failed to record last_notified_*_on", error.message);
    }
  }

  return sent;
}
