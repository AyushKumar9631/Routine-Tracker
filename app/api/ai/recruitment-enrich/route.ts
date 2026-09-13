// AI research endpoint for a recruitment drive (plan 1.6.A). One of the "new
// AI endpoints" that's the stated exception to the server-actions-only rule
// (1.1) — it exists as its own route (rather than a server action) so
// actions/recruitment.ts can schedule (via next/server's after()) a fetch to
// it and return immediately instead of blocking drive/round creation on the
// AI call. See plan doc H3 for why that scheduling matters.
//
// Not a pg_cron endpoint and not a public webhook, but it's still reachable
// without a user session (the trigger is a server-to-server fetch, not a
// browser request), so it's gated the same way the cron routes are: bearer
// CRON_SECRET. No new secret needed. This isn't spelled out in the plan —
// flagged as a note under F3 in the checklist.
//
// H5 rework: each research pass used to be a single Groq call asking for a
// whole JSON blob back. Now it's several small, independent, word-limited
// questions (see COMPANY_OVERVIEW_QUESTIONS / ROUND_PREP_QUESTIONS below),
// each run through the full model fallback chain (GROQ_RESEARCH_MODELS) on
// its own. A question that fails on every model in the chain just comes
// back blank in `content` — it does NOT fail the whole pass/row. This
// trades a bit of latency (multiple small calls instead of one big one,
// though they run concurrently via Promise.all) for much better resilience:
// one exhausted model, or one topic Groq's search can't find anything on,
// no longer takes out the whole company overview or round prep.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callGroqWithFallback, GROQ_RESEARCH_MODELS, type GroqChatMessage } from "@/lib/ai/groq";
import { ROUND_TYPE_LABELS } from "@/lib/recruitment";
import {
  COMPANY_OVERVIEW_QUESTIONS,
  ROUND_PREP_QUESTIONS,
  type CompanyOverviewContent,
  type RoundPrepContent,
} from "@/lib/ai/recruitment-research";

// Re-exported type-only so existing `import type { ... } from ".../route"`
// call sites keep working — type exports are erased at compile time and
// don't trip Next's route-export validation the way a value export would
// (that's exactly what moved COMPANY_OVERVIEW_FIELDS/ROUND_PREP_FIELDS out
// to lib/ai/recruitment-research.ts in the first place).
export type { CompanyOverviewContent, RoundPrepContent };

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface DriveDetails {
  activity_id: string;
  user_id: string;
  company_name: string;
  company_url: string | null;
  role: string;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const activityId: string | undefined = body?.activityId;
  const roundId: string | undefined = body?.roundId || undefined;
  if (!activityId) {
    return NextResponse.json({ error: "activityId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: details, error: detailsError } = await supabase
    .from("recruitment_details")
    .select("activity_id, user_id, company_name, company_url, role")
    .eq("activity_id", activityId)
    .maybeSingle();
  if (detailsError) {
    return NextResponse.json({ error: detailsError.message }, { status: 500 });
  }
  if (!details) {
    return NextResponse.json({ error: "Recruitment drive not found" }, { status: 404 });
  }

  let round: { id: string; round_type: string } | null = null;
  if (roundId) {
    const { data: roundRow, error: roundError } = await supabase
      .from("recruitment_rounds")
      .select("id, round_type")
      .eq("id", roundId)
      .eq("activity_id", activityId)
      .maybeSingle();
    if (roundError) {
      return NextResponse.json({ error: roundError.message }, { status: 500 });
    }
    if (!roundRow) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }
    round = roundRow;
  }

  const [overviewOutcome, roundPrepOutcome] = await Promise.all([
    runCompanyOverviewPass(supabase, details),
    round ? runRoundPrepPass(supabase, details, round) : Promise.resolve("not requested" as const),
  ]);

  return NextResponse.json({
    companyOverview: overviewOutcome,
    roundPrep: roundPrepOutcome,
  });
}

type PassOutcome = "ran" | "skipped" | "not requested";

/**
 * Finds the existing insight row for this (activity/round, kind) if any.
 * `skip: true` means it's already `ready` and shouldn't be regenerated.
 * Otherwise returns an insight id reset to `pending` — either a freshly
 * inserted row or an existing failed/pending one being retried in place, so
 * a retry (or the H4 "Start research" button) updates the same row rather
 * than accumulating duplicates.
 */
async function ensurePendingInsight(
  supabase: ReturnType<typeof createAdminClient>,
  params: { activityId: string; userId: string; roundId: string | null; kind: "company_overview" | "round_prep" }
): Promise<{ id: string; skip: boolean }> {
  let query = supabase
    .from("recruitment_ai_insights")
    .select("id, status")
    .eq("activity_id", params.activityId)
    .eq("kind", params.kind);
  query = params.roundId ? query.eq("round_id", params.roundId) : query.is("round_id", null);
  const { data: existing, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);

  if (existing) {
    if (existing.status === "ready") return { id: existing.id, skip: true };
    const { error: updateError } = await supabase
      .from("recruitment_ai_insights")
      .update({ status: "pending", error: null })
      .eq("id", existing.id);
    if (updateError) throw new Error(updateError.message);
    return { id: existing.id, skip: false };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("recruitment_ai_insights")
    .insert({
      activity_id: params.activityId,
      user_id: params.userId,
      round_id: params.roundId,
      kind: params.kind,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  return { id: inserted.id, skip: false };
}

function researchSystemPrompt(maxWords: number): string {
  return (
    "You are a research assistant helping a job candidate prep for an interview. " +
    "Answer ONLY the question in the next message, in plain prose, no markdown, no " +
    `preamble, no restating the question. Maximum ${maxWords} words. If you don't have ` +
    'reliable information to answer, respond with exactly the single word "UNKNOWN" ' +
    "and nothing else -- never invent specifics."
  );
}

/** Model output that means "no answer" -- stored as null, not as text. */
function isUnknown(text: string): boolean {
  return /^unknown\.?$/i.test(text.trim());
}

/** Belt-and-suspenders word cap -- the prompt already asks for this, this
 * guarantees it regardless of whether a given model actually complied. */
function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ") + "\u2026";
}

function normalizeAnswer(raw: string, maxWords: number): string | null {
  const trimmed = raw.trim();
  if (!trimmed || isUnknown(trimmed)) return null;
  return truncateWords(trimmed, maxWords);
}

/**
 * Runs one research pass: every question in `questions` fires as its own
 * Groq call (through the full GROQ_RESEARCH_MODELS fallback chain),
 * concurrently. A question that fails on every model in the chain is
 * logged and stored as `null` -- it does not fail the pass. The row always
 * ends up `ready` once we get this far (the only way this pass reports
 * `"failed"` is if ensurePendingInsight itself throws, e.g. a genuine DB
 * error, before any question is even attempted).
 */
async function runResearchPass<K extends string>(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    activityId: string;
    userId: string;
    roundId: string | null;
    kind: "company_overview" | "round_prep";
    questions: { key: K; maxWords: number; userPrompt: string }[];
  }
): Promise<PassOutcome> {
  const { id, skip } = await ensurePendingInsight(supabase, {
    activityId: params.activityId,
    userId: params.userId,
    roundId: params.roundId,
    kind: params.kind,
  });
  if (skip) return "skipped";

  const answers = await Promise.all(
    params.questions.map(async ({ key, maxWords, userPrompt }) => {
      const messages: GroqChatMessage[] = [
        { role: "system", content: researchSystemPrompt(maxWords) },
        { role: "user", content: userPrompt },
      ];
      try {
        const { text } = await callGroqWithFallback(messages, GROQ_RESEARCH_MODELS, {
          withSearch: true,
          maxTokens: 800,
        });
        return [key, normalizeAnswer(text, maxWords)] as const;
      } catch (err) {
        // Every model in the fallback chain failed for this one question --
        // leave it blank rather than failing the whole pass.
        console.error(
          `recruitment-enrich: question "${String(key)}" (${params.kind}) failed on every fallback model`,
          err instanceof Error ? err.message : err
        );
        return [key, null] as const;
      }
    })
  );

  const content = Object.fromEntries(answers) as Record<K, string | null>;
  await supabase.from("recruitment_ai_insights").update({ status: "ready", content, error: null }).eq("id", id);
  return "ran";
}

async function runCompanyOverviewPass(
  supabase: ReturnType<typeof createAdminClient>,
  details: DriveDetails
): Promise<PassOutcome> {
  return runResearchPass(supabase, {
    activityId: details.activity_id,
    userId: details.user_id,
    roundId: null,
    kind: "company_overview",
    questions: COMPANY_OVERVIEW_QUESTIONS.map((q) => ({
      key: q.key,
      maxWords: q.maxWords,
      userPrompt: q.question(details, ""),
    })),
  });
}

async function runRoundPrepPass(
  supabase: ReturnType<typeof createAdminClient>,
  details: DriveDetails,
  round: { id: string; round_type: string }
): Promise<PassOutcome> {
  const roundLabel = ROUND_TYPE_LABELS[round.round_type as keyof typeof ROUND_TYPE_LABELS] ?? round.round_type;
  return runResearchPass(supabase, {
    activityId: details.activity_id,
    userId: details.user_id,
    roundId: round.id,
    kind: "round_prep",
    questions: ROUND_PREP_QUESTIONS.map((q) => ({
      key: q.key,
      maxWords: q.maxWords,
      userPrompt: q.question(details, roundLabel),
    })),
  });
}
