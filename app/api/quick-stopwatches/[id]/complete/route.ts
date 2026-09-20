import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Hit via navigator.sendBeacon from the client on pagehide/beforeunload, so
// an in-progress Quick Stopwatch never gets silently lost when the tab
// closes. sendBeacon can't set custom headers, so there's no body — the id
// lives in the URL and auth rides the same-origin session cookie sendBeacon
// always includes.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { data: current } = await supabase
    .from("quick_stopwatches")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!current || current.status === "completed") {
    return NextResponse.json({ ok: true });
  }

  const accumulated_seconds =
    current.status === "running"
      ? current.accumulated_seconds + (Date.now() - new Date(current.running_since).getTime()) / 1000
      : current.accumulated_seconds;

  await supabase
    .from("quick_stopwatches")
    .update({
      status: "completed",
      running_since: null,
      accumulated_seconds,
      completed_at: new Date().toISOString(),
      period_key: todayKey(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
