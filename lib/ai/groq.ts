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

// Research passes (H7) step through these in priority order, one model
// attempt per question per step() call — see app/api/ai/recruitment-enrich/
// step/route.ts for the state machine that walks this list. Each model ID
// has its OWN separate rate-limit bucket on Groq (per-model, not
// shared/pooled — see plan doc H5) so a 429 on one doesn't mean the next is
// exhausted too.
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
 * Thrown on any Groq call failure — missing key, HTTP error, timeout,
 * malformed response. `status` carries the HTTP status Groq responded with
 * (when there was one) so callers can tell "a clean rate/token-limit
 * rejection" (429) apart from everything else (network failure, our own
 * timeout, a 5xx, a malformed body) — see isRateLimitError below. The H7
 * step endpoint treats those two categories very differently: a 429 means
 * "try the next model in the fallback chain"; anything else means "this
 * might just be a transient blip, worth retrying the same model for a
 * while before giving up on the question."
 */
export class GroqApiError extends Error {
  readonly model?: string;
  readonly status?: number;
  constructor(message: string, model?: string, status?: number) {
    super(message);
    this.name = "GroqApiError";
    this.model = model;
    this.status = status;
  }
}

/** True for a clean, definitive "you're rate/token limited" rejection from
 * Groq (always HTTP 429 — covers both RPM/RPD request caps and TPM/TPD
 * token caps, Groq doesn't distinguish them at the status-code level). */
export function isRateLimitError(err: unknown): boolean {
  return err instanceof GroqApiError && err.status === 429;
}

/**
 * Calls Groq's chat-completions endpoint with one specific model, returns
 * the assistant's reply text. `withSearch` requests the `browser_search`
 * tool — silently dropped for models that don't support it (see
 * BROWSER_SEARCH_MODELS above) instead of sending a request Groq would
 * reject outright.
 *
 * `timeoutMs` (default 20s) aborts a hung/slow request rather than letting
 * it run indefinitely — every call site now bounds this well below the
 * route's maxDuration, since H7 moved to a client-driven step loop where
 * each server round-trip must stay short (see step/route.ts's doc comment
 * for why one request can no longer just wait out a whole fallback chain).
 */
export async function callGroq(
  messages: GroqChatMessage[],
  model: string,
  opts: { withSearch?: boolean; maxTokens?: number; timeoutMs?: number } = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqApiError("GROQ_API_KEY is not set", model);
  }

  const canSearch = Boolean(opts.withSearch) && BROWSER_SEARCH_MODELS.has(model);
  const timeoutMs = opts.timeoutMs ?? 20_000;

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
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new GroqApiError(
      timedOut
        ? `Groq request to ${model} timed out after ${timeoutMs}ms`
        : `Groq request failed: ${err instanceof Error ? err.message : String(err)}`,
      model
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GroqApiError(`Groq API error (${model}): ${res.status} ${body}`.trim(), model, res.status);
  }

  const json = await res.json().catch(() => null);
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content) {
    throw new GroqApiError(`Groq response missing choices[0].message.content (${model})`, model);
  }

  return content;
}
