import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractScreenTimeValue, parseScreenTimeMinutes } from "@/lib/screentime";
import { todayKey } from "@/lib/utils";

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
    .select("id, activity_id, user_id")
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

  const minutes = parseScreenTimeMinutes(extractScreenTimeValue(payload));

  await supabase
    .from("screentime_config")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", config.id);

  if (minutes === null) {
    return NextResponse.json({ ok: false, reason: "unrecognized value" }, { status: 200 });
  }

  const { error } = await supabase.from("completions").upsert(
    {
      activity_id: config.activity_id,
      user_id: config.user_id,
      period_key: todayKey(),
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

  return NextResponse.json({ ok: true, minutes });
}
