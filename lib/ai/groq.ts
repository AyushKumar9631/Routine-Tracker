// Thin server-side wrapper around Groq's OpenAI-compatible chat-completions
// endpoint. No SDK — one fetch call, matching lib/leetcode.ts / lib/notify.ts.
//
// GROQ_API_KEY is server-only, never exposed to the client — same care as
// SUPABASE_SERVICE_ROLE_KEY gets elsewhere in this repo.

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Chat (G1) runs on Groq's own agentic "Compound" system instead of a plain
// model. Unlike the research models below, it has real-time web search (plus
// code execution, page-visiting, Wolfram Alpha) built in server-side and
// decides on its own when to reach for it — no `tools` param needed, and
// nothing to fall back from. It also has NO daily token cap (TPD), only
// 30 RPM / 250 RPD / 70K TPM, tracked in its own bucket, separate from every
// model in GROQ_RESEARCH_MODELS below (console.groq.com/docs/rate-limits and
// console.groq.com/docs/compound, checked 2026-09-13 — re-check before
// assuming either fact still holds if this ever errors unexpectedly).
export const GROQ_CHAT_MODEL = "groq/compound";

// Research passes (F2/F3) try these in order, per sub-question call, falling
// through to the next model if one fails (rate limit, outage, bad response).
// Each model ID has its OWN separate rate-limit bucket on Groq (per-model,
// not shared/pooled) — see plan doc H5 — so a 429 on one doesn't mean the
// next is exhausted too, unlike retrying the same model again.
//
// Only the first three actually support the `browser_search` built-in tool
// (console.groq.com/docs/browser-search, checked 2026-09-13) — the Qwen
// models don't have any web-search tool on Groq at all. `callGroq` below
// silently drops the tool for models that don't support it rather than
// sending a request Groq would reject, so a call that falls through to
// Qwen still returns a best-effort answer from the model's own training
// data — better than an empty field, just not live-researched.
export const GROQ_RESEARCH_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-safeguard-20b",
  "qwen/qwen3.6-27b",
  "qwen/qwen3.8-27b",
] as const;

const BROWSER_SEARCH_MODELS = new Set<string>([
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-safeguard-20b",
]);

export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Thrown on any single-model Groq call failure — missing key, HTTP error,
 * malformed response. `callGroqWithFallback` catches this per-model and
 * moves on to the next one; the research passes catch whatever comes out of
 * the full chain and store it per-question (missing question, not a failed
 * row). The chat route (no fallback chain — one model) still catches this
 * directly and turns it into a 502.
 */
export class GroqApiError extends Error {
  readonly model?: string;
  constructor(message: string, model?: string) {
    super(message);
    this.name = "GroqApiError";
    this.model = model;
  }
}

/**
 * Calls Groq's chat-completions endpoint with one specific model, returns
 * the assistant's reply text. `withSearch` requests the `browser_search`
 * tool — silently dropped for models that don't support it (see
 * BROWSER_SEARCH_MODELS above) instead of sending a request Groq would
 * reject outright.
 */
export async function callGroq(
  messages: GroqChatMessage[],
  model: string,
  opts: { withSearch?: boolean; maxTokens?: number } = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqApiError("GROQ_API_KEY is not set", model);
  }

  const canSearch = Boolean(opts.withSearch) && BROWSER_SEARCH_MODELS.has(model);

  let res: Response;
  try {
    res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(opts.maxTokens ? { max_completion_tokens: opts.maxTokens } : {}),
        // Forcing the tool (rather than leaving it "auto") matters here: these
        // are short, specific research questions the model usually can't
        // answer accurately from training data alone (e.g. "recent news"),
        // so we want it to actually look rather than guess.
        ...(canSearch ? { tools: [{ type: "browser_search" }], tool_choice: "required" } : {}),
      }),
      cache: "no-store",
    });
  } catch (err) {
    throw new GroqApiError(
      `Groq request failed: ${err instanceof Error ? err.message : String(err)}`,
      model
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GroqApiError(`Groq API error (${model}): ${res.status} ${body}`.trim(), model);
  }

  const json = await res.json().catch(() => null);
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content) {
    throw new GroqApiError(`Groq response missing choices[0].message.content (${model})`, model);
  }

  return content;
}

/**
 * Tries each model in `models`, in priority order, until one succeeds.
 * Used by the research passes so a rate limit or outage on one model
 * doesn't fail the whole question — it just moves on to the next model's
 * separate quota bucket. Throws only if every model in the chain fails,
 * carrying the last model's error (callers treat that as "this one
 * question stays blank", not as failing the whole research pass).
 */
export async function callGroqWithFallback(
  messages: GroqChatMessage[],
  models: readonly string[],
  opts: { withSearch?: boolean; maxTokens?: number } = {}
): Promise<{ text: string; model: string }> {
  let lastErr: unknown;
  for (const model of models) {
    try {
      const text = await callGroq(messages, model, opts);
      return { text, model };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new GroqApiError("All fallback models failed");
}
