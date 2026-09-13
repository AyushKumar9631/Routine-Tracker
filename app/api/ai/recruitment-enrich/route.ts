// AI research endpoint for a recruitment drive (plan 1.6.A). One of the "new
// AI endpoints" that's the stated exception to the server-actions-only rule
// (1.1) — it exists as its own route (rather than a server action) so
// actions/recruitment.ts can fire-and-forget an un-awaited fetch to it and
// return immediately instead of blocking drive/round creation on the AI call.
//
// Not a pg_cron endpoint and not a public webhook, but it's still reachable
// without a user session (the trigger is a server-to-server fetch, not a
// browser request), so it's gated the same way the cron routes are: bearer
// CRON_SECRET. No new secret needed. This isn't spelled out in the plan —
// flagged as a note under F3 in the checklist.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callGroq, GroqApiError, type GroqChatMessage } from "@/lib/ai/groq";
import { ROUND_TYPE_LABELS } from "@/lib/recruitment";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Shapes stored in recruitment_ai_insights.content — kept local to this route
// since nothing else writes these rows yet; F4 (detail-page UI) reads the
// same two shapes back out and should mirror these types when it lands.
interface CompanyOverviewContent {
  summary: string;
  highlights: string[];
}

interface RoundPrepContent {
  topics: string[];
  duration: string;
  format: string;
  questionCount: string;
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

interface DriveDetails {
  activity_id: string;
  user_id: string;
  company_name: string;
  company_url: string | null;
  role: string;
}

/**
 * Finds the existing insight row for this (activity/round, kind) if any.
 * `skip: true` means it's already `ready` and shouldn't be regenerated.
 * Otherwise returns an insight id reset to `pending` — either a freshly
 * inserted row or an existing failed/pending one being retried in place, so
 * a retry updates the same row rather than accumulating duplicates.
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

/** Strips ```json fences the model adds despite being told not to, then parses. */
function parseModelJson<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned) as T;
}

async function runCompanyOverviewPass(
  supabase: ReturnType<typeof createAdminClient>,
  details: DriveDetails
): Promise<PassOutcome> {
  const { id, skip } = await ensurePendingInsight(supabase, {
    activityId: details.activity_id,
    userId: details.user_id,
    roundId: null,
    kind: "company_overview",
  });
  if (skip) return "skipped";

  const messages: GroqChatMessage[] = [
    {
      role: "system",
      content:
        "You are a research assistant helping a job candidate prep for an interview. " +
        "Respond with ONLY strict JSON, no markdown fences, no commentary, matching this " +
        'type: { "summary": string, "highlights": string[] }. `summary` is 2-4 sentences ' +
        "on what the company does, its size/stage, and anything recent worth knowing. " +
        "`highlights` is 3-5 short facts useful the day before an interview (funding, " +
        "culture, notable products, interview reputation). If you can't find much, say " +
        "so plainly in `summary` rather than inventing specifics.",
    },
    {
      role: "user",
      content: details.company_url
        ? `Company: ${details.company_name} (${details.company_url})`
        : `Company: ${details.company_name}`,
    },
  ];

  try {
    const raw = await callGroq(messages, true);
    const content = parseModelJson<CompanyOverviewContent>(raw);
    await supabase
      .from("recruitment_ai_insights")
      .update({ status: "ready", content, error: null })
      .eq("id", id);
  } catch (err) {
    const message =
      err instanceof GroqApiError || err instanceof Error ? err.message : "AI request failed";
    await supabase.from("recruitment_ai_insights").update({ status: "failed", error: message }).eq("id", id);
  }
  return "ran";
}

async function runRoundPrepPass(
  supabase: ReturnType<typeof createAdminClient>,
  details: DriveDetails,
  round: { id: string; round_type: string }
): Promise<PassOutcome> {
  const { id, skip } = await ensurePendingInsight(supabase, {
    activityId: details.activity_id,
    userId: details.user_id,
    roundId: round.id,
    kind: "round_prep",
  });
  if (skip) return "skipped";

  const roundLabel = ROUND_TYPE_LABELS[round.round_type as keyof typeof ROUND_TYPE_LABELS] ?? round.round_type;

  const messages: GroqChatMessage[] = [
    {
      role: "system",
      content:
        "You are a research assistant helping a job candidate prep for one specific " +
        "interview round. Respond with ONLY strict JSON, no markdown fences, no " +
        'commentary, matching this type: { "topics": string[], "duration": string, ' +
        '"format": string, "questionCount": string }. Base this on publicly known ' +
        "interview experiences for this company/role/round combination where you have " +
        "them; otherwise give a reasonable general expectation for that round type and " +
        "say it's a general estimate rather than inventing false specifics.",
    },
    {
      role: "user",
      content: `Company: ${details.company_name}\nRole: ${details.role}\nRound type: ${roundLabel}`,
    },
  ];

  try {
    const raw = await callGroq(messages, true);
    const content = parseModelJson<RoundPrepContent>(raw);
    await supabase
      .from("recruitment_ai_insights")
      .update({ status: "ready", content, error: null })
      .eq("id", id);
  } catch (err) {
    const message =
      err instanceof GroqApiError || err instanceof Error ? err.message : "AI request failed";
    await supabase.from("recruitment_ai_insights").update({ status: "failed", error: message }).eq("id", id);
  }
  return "ran";
}
