import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Public route: receives daily summary of all app usage from iPhone.
// The iPhone Shortcut aggregates all open/close events locally and sends once per day.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Verify token belongs to a valid screentime_config
  const { data: config } = await supabase
    .from("screentime_config")
    .select("id, user_id, activity_id")
    .eq("token", token)
    .maybeSingle();

  if (!config) {
    return NextResponse.json({ error: "Unknown webhook token" }, { status: 404 });
  }

  const rawText = await request.text();
  let payload: any;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid JSON", raw: rawText.slice(0, 200) },
      { status: 200 }
    );
  }

  const { apps, total_minutes, date } = payload;

  if (!apps || !Array.isArray(apps)) {
    return NextResponse.json(
      { ok: false, reason: "missing apps array", payload },
      { status: 200 }
    );
  }

  const today = date || todayKey();
  const now = new Date().toISOString();

  // Store each app's usage
  const appRecords = apps.map((app: any) => ({
    user_id: config.user_id,
    app_name: app.name || app.app_name,
    app_bundle_id: app.bundle_id || app.app_bundle_id || null,
    opened_at: now, // Not used for summary data, but required by schema
    closed_at: now,
    duration_minutes: app.duration_minutes || app.duration || 0,
    date_key: today,
  }));

  // Clear existing records for today (in case this is a re-send)
  await supabase
    .from("app_usage")
    .delete()
    .eq("user_id", config.user_id)
    .eq("date_key", today);

  // Insert new records
  const { error: insertError } = await supabase
    .from("app_usage")
    .insert(appRecords);

  if (insertError) {
    console.error("app_usage bulk insert failed", insertError.message);
    return NextResponse.json({ ok: false, reason: "db_error" }, { status: 200 });
  }

  // Update total screen time in completions table
  const totalMinutes = total_minutes || apps.reduce((sum: number, app: any) =>
    sum + (app.duration_minutes || app.duration || 0), 0
  );

  const { error: completionError } = await supabase
    .from("completions")
    .upsert(
      {
        activity_id: config.activity_id,
        user_id: config.user_id,
        period_key: today,
        completed: true,
        value: totalMinutes,
        note: null,
        logged_at: now,
      },
      { onConflict: "activity_id,period_key" }
    );

  if (completionError) {
    console.error("completions upsert failed", completionError.message);
  }

  // Update last synced timestamp
  await supabase
    .from("screentime_config")
    .update({ last_synced_at: now })
    .eq("id", config.id);

  return NextResponse.json({
    ok: true,
    date_key: today,
    total_minutes: totalMinutes,
    app_count: apps.length,
    stored: appRecords.length,
  });
}
