// Thin wrapper around the ntfy.sh push channel. This is the one file that
// changes if the channel is ever swapped (Pushover, Telegram, etc.) — every
// caller just gets a boolean back and doesn't know or care how the push
// actually happened.
//
// Per-user: each user connects their own topic (see actions/notifications.ts
// and notification_settings), so this takes the topic as an argument rather
// than reading a single shared env var.

const NTFY_BASE_URL = "https://ntfy.sh";

/**
 * Sends a push notification to a given ntfy.sh topic. Returns whether the
 * send actually succeeded — checks the response status, not just whether
 * the request threw.
 */
export async function sendNotification(
  topic: string,
  title: string,
  body: string
): Promise<boolean> {
  if (!topic) {
    console.error("sendNotification: no topic provided");
    return false;
  }

  try {
    const res = await fetch(`${NTFY_BASE_URL}/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: { Title: title },
      body,
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`sendNotification: ntfy responded ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendNotification: request failed", err);
    return false;
  }
}
