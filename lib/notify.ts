// Thin wrapper around the ntfy.sh push channel. This is the one file that
// changes if the channel is ever swapped (Pushover, Telegram, etc.) — every
// caller just gets a boolean back and doesn't know or care how the push
// actually happened.

/**
 * Sends a push notification via ntfy.sh (topic URL from NTFY_TOPIC_URL).
 * Returns whether the send actually succeeded — checks the response status,
 * not just whether the request threw.
 */
export async function sendNotification(title: string, body: string): Promise<boolean> {
  const topicUrl = process.env.NTFY_TOPIC_URL;
  if (!topicUrl) {
    console.error("sendNotification: NTFY_TOPIC_URL is not set");
    return false;
  }

  try {
    const res = await fetch(topicUrl, {
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
