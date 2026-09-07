"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function logCompletion(
  activityId: string,
  periodKey: string,
  payload: { completed: boolean; value?: number | null; note?: string | null }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("completions").upsert(
    {
      activity_id: activityId,
      user_id: user.id,
      period_key: periodKey,
      completed: payload.completed,
      value: payload.value ?? null,
      note: payload.note ?? null,
      logged_at: new Date().toISOString(),
    },
    { onConflict: "activity_id,period_key" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath(`/activities/${activityId}`);
}

export async function deleteCompletion(activityId: string, periodKey: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("completions")
    .delete()
    .eq("activity_id", activityId)
    .eq("period_key", periodKey)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath(`/activities/${activityId}`);
}
