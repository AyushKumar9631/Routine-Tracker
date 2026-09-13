// Thin server-side wrapper around Groq's OpenAI-compatible chat-completions
// endpoint. No SDK — one fetch call, matching lib/leetcode.ts / lib/notify.ts.
//
// GROQ_API_KEY is server-only, never exposed to the client — same care as
// SUPABASE_SERVICE_ROLE_KEY gets elsewhere in this repo.

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// One model for every call — research passes (1.6.A) and chat (1.6.B) alike.
// If this or `browser_search` availability ever changes, check
// console.groq.com/docs/browser-search and console.groq.com/docs/models
// before swapping — don't guess.
const GROQ_MODEL = "openai/gpt-oss-120b";

export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Thrown on any Groq call failure — missing key, HTTP error, malformed
 * response. Callers (F3 enrich route, G1 chat route) catch this and turn it
 * into `recruitment_ai_insights.status = 'failed'` + `.error = err.message`.
 */
export class GroqApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroqApiError";
  }
}

/**
 * Calls Groq's chat-completions endpoint, returns the assistant's reply text.
 * Pass `withSearch: true` for the two research passes (1.6.A) — omit for
 * chat (1.6.B).
 */
export async function callGroq(
  messages: GroqChatMessage[],
  withSearch = false
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqApiError("GROQ_API_KEY is not set");
  }

  let res: Response;
  try {
    res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        ...(withSearch ? { tools: [{ type: "browser_search" }] } : {}),
      }),
      cache: "no-store",
    });
  } catch (err) {
    throw new GroqApiError(
      `Groq request failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GroqApiError(`Groq API error: ${res.status} ${body}`.trim());
  }

  const json = await res.json().catch(() => null);
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content) {
    throw new GroqApiError("Groq response missing choices[0].message.content");
  }

  return content;
}
