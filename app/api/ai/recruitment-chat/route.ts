// Chat route for the per-drive AI assistant (plan 1.6.B). Unlike the F3
// enrich route, this one is a normal user-facing endpoint — hit directly by
// the browser once G2 wires up a client component — so it authenticates the
// same way every server action in this repo does: the cookie-based client +
// RLS (see app/auth/callback/route.ts for the existing precedent of a Route
// Handler using this same client), not the admin client + CRON_SECRET the
// fire-and-forget enrich route needs.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callGroq, GroqApiError, type GroqChatMessage } from "@/lib/ai/groq";
import { currentRound, isSelfAssessment, RESULT_LABELS, ROUND_TYPE_LABELS } from "@/lib/recruitment";
import type { CompanyOverviewContent, RoundPrepContent } from "@/app/api/ai/recruitment-enrich/route";
import type {
  RecruitmentAiInsight,
  RecruitmentChatMessage,
  RecruitmentDetails,
  RecruitmentRound,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const activityId: string | undefined = body?.activityId;
  const message: string = (body?.message ?? "").trim();
  if (!activityId) {
    return NextResponse.json({ error: "activityId is required" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const { data: detailsData, error: detailsError } = await supabase
    .from("recruitment_details")
    .select("*")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (detailsError) {
    return NextResponse.json({ error: detailsError.message }, { status: 500 });
  }
  const details = detailsData as RecruitmentDetails | null;
  if (!details) {
    return NextResponse.json({ error: "Recruitment drive not found" }, { status: 404 });
  }

  const { data: roundsData, error: roundsError } = await supabase
    .from("recruitment_rounds")
    .select("*")
    .eq("activity_id", activityId);
  if (roundsError) {
    return NextResponse.json({ error: roundsError.message }, { status: 500 });
  }
  const round = currentRound((roundsData ?? []) as RecruitmentRound[]);

  const { data: insightsData, error: insightsError } = await supabase
    .from("recruitment_ai_insights")
    .select("*")
    .eq("activity_id", activityId)
    .eq("status", "ready");
  if (insightsError) {
    return NextResponse.json({ error: insightsError.message }, { status: 500 });
  }
  const insights = (insightsData ?? []) as RecruitmentAiInsight[];
  const overview = insights.find((i) => i.kind === "company_overview" && i.round_id === null);
  const roundPrep = round
    ? insights.find((i) => i.kind === "round_prep" && i.round_id === round.id)
    : undefined;

  const { data: historyData, error: historyError } = await supabase
    .from("recruitment_chat_messages")
    .select("*")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true });
  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 });
  }
  const history = (historyData ?? []) as RecruitmentChatMessage[];

  const messages: GroqChatMessage[] = [
    { role: "system", content: buildSystemMessage(details, round, overview, roundPrep) },
    ...history.map((m): GroqChatMessage => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  // `withSearch: true` — chat now has the same `browser_search` tool the
  // research passes use (plan 1.6.B explicitly reserved this as a flip-able
  // option: "if a later task decides the chat should also be able to
  // search, just add tools: [{"type": "browser_search"}] to its call").
  // Passing the tool doesn't force a search on every turn — the model only
  // invokes it when it decides the grounded context below isn't enough
  // (e.g. the user explicitly asks it to look something up, or asks about
  // something more current than what the research passes captured).
  let reply: string;
  try {
    reply = await callGroq(messages, true);
  } catch (err) {
    const errorMessage =
      err instanceof GroqApiError || err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }

  // Persist both sides together, only once the reply actually exists — a
  // failed Groq call above returns before this, so a user message is never
  // saved without its reply (recruitment_chat_messages has no
  // pending/failed status column to represent that half-state).
  const { error: insertError } = await supabase.from("recruitment_chat_messages").insert([
    { activity_id: activityId, user_id: user.id, role: "user", content: message },
    { activity_id: activityId, user_id: user.id, role: "assistant", content: reply },
  ]);
  if (insertError) {
    return NextResponse.json({
      reply,
      warning: `Reply sent, but failed to save chat history: ${insertError.message}`,
    });
  }

  return NextResponse.json({ reply });
}

function buildSystemMessage(
  details: RecruitmentDetails,
  round: RecruitmentRound | undefined,
  overview: RecruitmentAiInsight | undefined,
  roundPrep: RecruitmentAiInsight | undefined
): string {
  const lines: string[] = [
    "You are an interview-prep assistant helping the candidate get ready for this " +
      "recruitment drive. Ground your answers in the context below first. You also " +
      "have a browser_search tool available — use it when the context below doesn't " +
      "cover what's being asked (e.g. the user asks you to look something up, or " +
      "wants something more current than what's in the research below), rather than " +
      "guessing or inventing specifics. Don't feel obligated to search for every " +
      "message — plain prep conversation grounded in the context below doesn't need it.",
    "",
    `Company: ${details.company_name}${details.company_url ? ` (${details.company_url})` : ""}`,
    `Role: ${details.role}`,
  ];

  if (round) {
    const dateNote = round.test_date ? `test date ${round.test_date}` : "no test date set yet";
    const resultNote = isSelfAssessment(round.result)
      ? `, self-assessed so far: ${RESULT_LABELS[round.result]}`
      : "";
    lines.push(
      `Current round: Round ${round.round_no}, ${ROUND_TYPE_LABELS[round.round_type]} (${dateNote}${resultNote})`
    );
  }

  lines.push("");
  const overviewContent = overview?.content as CompanyOverviewContent | undefined;
  if (overviewContent) {
    lines.push(
      "Company overview:",
      overviewContent.summary,
      ...overviewContent.highlights.map((h) => `- ${h}`)
    );
  } else {
    lines.push("Company overview: not researched yet.");
  }

  lines.push("");
  const roundPrepContent = roundPrep?.content as RoundPrepContent | undefined;
  if (roundPrepContent) {
    lines.push(
      "Round prep for the current round:",
      `Format: ${roundPrepContent.format}`,
      `Duration: ${roundPrepContent.duration}`,
      `Question count: ${roundPrepContent.questionCount}`,
      "Topics:",
      ...roundPrepContent.topics.map((t) => `- ${t}`)
    );
  } else {
    lines.push("Round prep for the current round: not researched yet.");
  }

  return lines.join("\n");
}
