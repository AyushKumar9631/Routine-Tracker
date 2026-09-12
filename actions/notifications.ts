"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendNotification } from "@/lib/notify";

/**
 * Pulls a bare ntfy topic name out of whatever the user pasted — either a
 * full https://ntfy.sh/<topic> URL or just the topic name itself.
 */
function parseTopic(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Enter a topic name or ntfy.sh URL");

  const lastSegment = trimmed.split("/").pop() ?? "";
  if (!lastSegment) throw new Error("Couldn't find a topic name in that");

  return lastSegment;
}

/** The current user's connected topic, or null if they haven't connected one. */
export async function getNotificationTopic(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("notification_settings")
    .select("ntfy_topic")
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.ntfy_topic ?? null;
}

/** Saves (or replaces) the current user's topic. Returns the normalized topic name. */
export async function saveNotificationTopic(rawInput: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const topic = parseTopic(rawInput);

  const { error } = await supabase
    .from("notification_settings")
    .upsert({ user_id: user.id, ntfy_topic: topic }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/activities");
  return topic;
}

export async function disconnectNotifications(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("notification_settings")
    .update({ ntfy_topic: null })
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/activities");
}

/** Sends a one-off test push to the current user's connected topic. */
export async function sendTestNotification(): Promise<boolean> {
  const topic = await getNotificationTopic();
  if (!topic) throw new Error("Connect a topic first");

  return sendNotification(
    topic,
    "Routine Tracker",
    "Test notification — if you see this, it works."
  );
}
