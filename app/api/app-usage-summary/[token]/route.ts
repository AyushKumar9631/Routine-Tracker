import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Public route: aggregates all app usage for today and returns summary data.
// This endpoint can be called by an end-of-day automation to get the full breakdown.
// It also calculates total screen time from all apps.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Verify token belongs to a valid screentime_config
  const { data: config } = await supabase
    .from("screentime_config")
    .select("id, user_id")
    .eq("token", token)
    .maybeSingle();

  if (!config) {
    return NextResponse.json({ error: "Unknown webhook token" }, { status: 404 });
  }

  const today = todayKey();

  // Fetch all app usage entries for today
  const { data: usage, error } = await supabase
    .from("app_usage")
    .select("app_name, app_bundle_id, opened_at, closed_at, duration_minutes")
    .eq("user_id", config.user_id)
    .eq("date_key", today)
    .order("opened_at", { ascending: true });

  if (error) {
    console.error("app_usage query failed", error.message);
    return NextResponse.json({ ok: false, reason: "db_error" }, { status: 200 });
  }

  // Group by app_name and sum durations
  const appTotals = new Map<string, { duration: number; sessions: number; bundle_id?: string }>();

  for (const entry of usage || []) {
    if (entry.duration_minutes != null) {
      const current = appTotals.get(entry.app_name) || { duration: 0, sessions: 0 };
      appTotals.set(entry.app_name, {
        duration: current.duration + entry.duration_minutes,
        sessions: current.sessions + 1,
        bundle_id: entry.app_bundle_id || current.bundle_id,
      });
    }
  }

  // Calculate total screen time across all apps
  const totalMinutes = Array.from(appTotals.values()).reduce((sum, app) => sum + app.duration, 0);

  // Convert to array and sort by duration (descending)
  const apps = Array.from(appTotals.entries())
    .map(([name, data]) => ({
      app_name: name,
      app_bundle_id: data.bundle_id,
      duration_minutes: data.duration,
      sessions: data.sessions,
      percentage: totalMinutes > 0 ? Math.round((data.duration / totalMinutes) * 100) : 0,
    }))
    .sort((a, b) => b.duration_minutes - a.duration_minutes);

  return NextResponse.json({
    ok: true,
    date_key: today,
    total_minutes: totalMinutes,
    app_count: apps.length,
    apps,
  });
}
