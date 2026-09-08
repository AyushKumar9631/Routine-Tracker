import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGfgActivity } from "@/lib/gfg-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: activeActivities, error: activitiesError } = await supabase
    .from("activities")
    .select("id, user_id")
    .eq("automation_type", "gfg_potd")
    .eq("is_active", true);

  if (activitiesError) {
    return NextResponse.json({ error: activitiesError.message }, { status: 500 });
  }
  if (!activeActivities || activeActivities.length === 0) {
    return NextResponse.json({ checked: 0, results: [] });
  }

  const { data: configs, error: configError } = await supabase
    .from("gfg_potd_config")
    .select("activity_id, gfg_username, last_known_streak")
    .in(
      "activity_id",
      activeActivities.map((a) => a.id)
    );

  if (configError) {
    return NextResponse.json({ error: configError.message }, { status: 500 });
  }

  const userByActivity = new Map(activeActivities.map((a) => [a.id, a.user_id]));

  const results = await Promise.all(
    (configs ?? []).map(async (cfg) => {
      const userId = userByActivity.get(cfg.activity_id);
      if (!userId) return { activity_id: cfg.activity_id, error: "no matching activity" };
      try {
        const result = await syncGfgActivity(
          supabase,
          cfg.activity_id,
          userId,
          cfg.gfg_username,
          cfg.last_known_streak
        );
        return { activity_id: cfg.activity_id, ...result };
      } catch (err) {
        return {
          activity_id: cfg.activity_id,
          error: err instanceof Error ? err.message : "sync failed",
        };
      }
    })
  );

  return NextResponse.json({ checked: results.length, results });
}
