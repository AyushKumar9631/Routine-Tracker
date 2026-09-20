"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { QuickStopwatch } from "@/lib/types";
import { todayKey } from "@/lib/utils";

export async function startQuickStopwatch(label: string): Promise<QuickStopwatch> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const trimmed = label.trim();
  if (!trimmed) throw new Error("Give the stopwatch a label");

  const { data, error } = await supabase
    .from("quick_stopwatches")
    .insert({
      user_id: user.id,
      label: trimmed,
      status: "running",
      running_since: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/");
  return data as QuickStopwatch;
}

export async function pauseQuickStopwatch(id: string): Promise<QuickStopwatch> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: current } = await supabase
    .from("quick_stopwatches")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!current || current.status !== "running") return current as QuickStopwatch;

  const elapsed = (Date.now() - new Date(current.running_since).getTime()) / 1000;

  const { data, error } = await supabase
    .from("quick_stopwatches")
    .update({
      status: "paused",
      running_since: null,
      accumulated_seconds: current.accumulated_seconds + elapsed,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as QuickStopwatch;
}

export async function resumeQuickStopwatch(id: string): Promise<QuickStopwatch> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("quick_stopwatches")
    .update({ status: "running", running_since: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "paused")
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as QuickStopwatch;
}

export async function completeQuickStopwatch(id: string): Promise<QuickStopwatch> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: current } = await supabase
    .from("quick_stopwatches")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!current) throw new Error("Stopwatch not found");
  if (current.status === "completed") return current as QuickStopwatch;

  const accumulated_seconds =
    current.status === "running"
      ? current.accumulated_seconds + (Date.now() - new Date(current.running_since).getTime()) / 1000
      : current.accumulated_seconds;

  const { data, error } = await supabase
    .from("quick_stopwatches")
    .update({
      status: "completed",
      running_since: null,
      accumulated_seconds,
      completed_at: new Date().toISOString(),
      period_key: todayKey(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/");
  return data as QuickStopwatch;
}
