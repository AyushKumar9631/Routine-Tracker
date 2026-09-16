// Client-driven "do one unit of work" endpoint for the sequential research
// stepper (plan H7). Replaces the old CRON_SECRET-gated
// app/api/ai/recruitment-enrich/route.ts entirely — that route no longer
// exists. Unlike that route (server-to-server, ran a whole pass's worth of
// Groq calls in one request), this one is called directly and *repeatedly*
// by the browser while the detail page is open: each call does exactly ONE
// bounded Groq attempt (STEP_ATTEMPT_TIMEOUT_MS, ~25s) for the current
// unanswered question and returns immediately with updated progress. The
// browser keeps calling it in a loop (see components/recruitment-research-
// panel.tsx) until the row reports it's done or paused.
//
// Why not one big request that loops server-side, like H5/H6 did? Per this
// task's actual spec: each pass is now fully SEQUENTIAL (one question, then
// the next — not concurrent), and a single question is allowed up to
// QUESTION_TIMEOUT_MS (10 minutes) of patience before the stepper gives up
// on it. Five questions per pass, sequentially, each with up to 10 minutes
// of patience, is up to 50 minutes worst case for one pass alone — no
// serverless function's maxDuration can hold a request open that long (H6
// already hit this wall trying to bound a much shorter *concurrent*
// fan-out). Spreading the wait across many short, cheap polls sidesteps the
// platform limit entirely: no single request here ever needs to run longer
// than one bounded Groq call. The 10-minute-per-question patience is real,
// it's just tracked as accumulated wall-clock time in
// `progress.questionStartedAt` across however many polls it takes, rather
// than as one blocking wait — which also happens to be exactly what makes
// live "3 of 10 answered" progress possible at all.
//
// Every response includes the row's full, current `content` (not just
// counts) so the client can render answers as they land without a separate
// re-fetch, and `currentQuestion` (the key being worked on, when there is
// one) so the client can show "trying <model> for '<question label>'"
// using the FIELDS label metadata it already has.
//
// Auth: same cookie-based session + RLS as the chat route (G1) — this is a
// normal user-facing endpoint, not a CRON_SECRET server-to-server one.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callGroq, isRateLimitError, GROQ_RESEARCH_MODELS, type GroqChatMessage } from "@/lib/ai/groq";
import { ROUND_TYPE_LABELS } from "@/lib/recruitment";
import {
  COMPANY_OVERVIEW_QUESTIONS,
  ROUND_PREP_QUESTIONS,
  QUESTION_TIMEOUT_MS,
  STEP_ATTEMPT_TIMEOUT_MS,
  countAnswered,
  findNextAttemptableIndex,
  normalizeAnswer,
  researchSystemPrompt,
  withMissingQuestionsFilled,
  type QuestionRecord,
  type RowProgress,
} from "@/lib/ai/recruitment-research";

export const dynamic = "force-dynamic";
export const maxDuration = 45; // one bounded Groq attempt (<=25s) plus a little DB overhead — never a whole pass

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const insightId: string | undefined = body?.insightId;
  if (!insightId) {
    return NextResponse.json({ error: "insightId is required" }, { status: 400 });
  }

  const { data: row, error: rowError } = await supabase
    .from("recruitment_ai_insights")
    .select("id, activity_id, round_id, kind, status, content, progress")
    .eq("id", insightId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (rowError) return NextResponse.json({ error: rowError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Insight not found" }, { status: 404 });

  const questions = row.kind === "company_overview" ? COMPANY_OVERVIEW_QUESTIONS : ROUND_PREP_QUESTIONS;
  const total = questions.length;
  const content = withMissingQuestionsFilled(questions, row.content as Record<string, QuestionRecord> | null);

  let progress = row.progress as RowProgress | null;

  // A previous run hit "every model rate-limited on this question" — halted
  // until a manual Start research/Retry (which clears haltReason) resumes
  // it. Report the current tally so the UI can still show "3 of 10, paused"
  // rather than nothing.
  if (progress?.haltReason) {
    return NextResponse.json({
      done: true,
      haltReason: progress.haltReason,
      answered: countAnswered(content),
      total,
      content,
    });
  }

  const nextIndex = findNextAttemptableIndex(questions, content);
  if (nextIndex === -1) {
    // Nothing left the stepper is willing to try automatically -- either
    // everything's answered, or whatever's left is "skipped" from an
    // earlier run (only a fresh Start research/Retry resets those).
    const answered = countAnswered(content);
    const allDone = answered === total;
    if (allDone && row.status !== "ready") {
      const { error: updateError } = await supabase
        .from("recruitment_ai_insights")
        .update({ status: "ready", content, progress: null })
        .eq("id", insightId);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ done: true, allDone, answered, total, content });
  }

  const question = questions[nextIndex];

  // Fetched fresh each step rather than cached on the row -- cheap, and
  // always current if the user edits the drive mid-research.
  const { data: details, error: detailsError } = await supabase
    .from("recruitment_details")
    .select("company_name, company_url, role")
    .eq("activity_id", row.activity_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (detailsError) return NextResponse.json({ error: detailsError.message }, { status: 500 });
  if (!details) return NextResponse.json({ error: "Recruitment drive not found" }, { status: 404 });

  let roundLabel = "";
  if (row.round_id) {
    const { data: roundRow, error: roundError } = await supabase
      .from("recruitment_rounds")
      .select("round_type")
      .eq("id", row.round_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (roundError) return NextResponse.json({ error: roundError.message }, { status: 500 });
    roundLabel = roundRow
      ? ROUND_TYPE_LABELS[roundRow.round_type as keyof typeof ROUND_TYPE_LABELS] ?? roundRow.round_type
      : "";
  }

  // Fresh start on this question (first call ever for this row, or the
  // stepper has moved on from a different question since the last call) --
  // reset the fallback pointer and start the 10-minute clock. Persisted
  // immediately, BEFORE the Groq call, so the clock start survives even if
  // this exact attempt turns out ambiguous -- otherwise every "still
  // waiting" response below would look like a fresh start next time and
  // elapsed time would never actually accumulate.
  if (!progress || progress.currentQuestionKey !== question.key) {
    progress = {
      currentQuestionKey: question.key,
      currentModelIndex: 0,
      questionStartedAt: new Date().toISOString(),
      haltReason: null,
    };
    const { error: progressSaveError } = await supabase
      .from("recruitment_ai_insights")
      .update({ progress })
      .eq("id", insightId);
    if (progressSaveError) return NextResponse.json({ error: progressSaveError.message }, { status: 500 });
  }

  const model = GROQ_RESEARCH_MODELS[progress.currentModelIndex];
  const messages: GroqChatMessage[] = [
    { role: "system", content: researchSystemPrompt(question.maxWords) },
    { role: "user", content: question.question(details, roundLabel) },
  ];

  try {
    const text = await callGroq(messages, model, {
      withSearch: true,
      maxTokens: 800,
      timeoutMs: STEP_ATTEMPT_TIMEOUT_MS,
    });
    const answer = normalizeAnswer(text, question.maxWords);
    const nextContent = {
      ...content,
      [question.key]: { answer, state: (answer === null ? "unknown" : "resolved") as QuestionRecord["state"] },
    };
    const answered = countAnswered(nextContent);
    const allDone = answered === total;

    const { error: updateError } = await supabase
      .from("recruitment_ai_insights")
      .update({
        content: nextContent,
        progress: null, // done with this question -- next call picks a fresh one
        status: allDone ? "ready" : "pending",
        error: null,
      })
      .eq("id", insightId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({
      done: allDone,
      allDone,
      answered,
      total,
      justAnswered: question.key,
      currentQuestion: question.key,
      model,
      content: nextContent,
    });
  } catch (err) {
    if (isRateLimitError(err)) {
      const isLastModel = progress.currentModelIndex >= GROQ_RESEARCH_MODELS.length - 1;
      const nextProgress: RowProgress = isLastModel
        ? { ...progress, haltReason: "exhausted" }
        : { ...progress, currentModelIndex: progress.currentModelIndex + 1 };

      const { error: updateError } = await supabase
        .from("recruitment_ai_insights")
        .update({ progress: nextProgress })
        .eq("id", insightId);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

      return NextResponse.json({
        done: isLastModel,
        haltReason: isLastModel ? "exhausted" : undefined,
        advancingModel: !isLastModel,
        answered: countAnswered(content),
        total,
        currentQuestion: question.key,
        model,
        nextModel: isLastModel ? undefined : GROQ_RESEARCH_MODELS[nextProgress.currentModelIndex],
        content,
      });
    }

    // Ambiguous failure -- not a clean rate/token-limit rejection, and not
    // a valid answer either (network error, our own timeout, a malformed
    // response, a 5xx). Check the cumulative clock for THIS question.
    console.error(
      `recruitment-enrich/step: ambiguous failure on "${String(question.key)}" (${model})`,
      err instanceof Error ? err.message : err
    );
    const elapsedMs = Date.now() - Date.parse(progress.questionStartedAt as string);

    if (elapsedMs >= QUESTION_TIMEOUT_MS) {
      // Give up on this question for the rest of THIS run -- "skipped", not
      // "unattempted", so the stepper moves on to the next question instead
      // of immediately re-selecting this same stuck one. A fresh Start
      // research/Retry resets it back to "unattempted" for a clean second
      // try later (see resetSkippedToUnattempted in actions/recruitment.ts).
      const nextContent = { ...content, [question.key]: { answer: null, state: "skipped" as const } };
      const { error: updateError } = await supabase
        .from("recruitment_ai_insights")
        .update({ content: nextContent, progress: null })
        .eq("id", insightId);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

      return NextResponse.json({
        done: false,
        skipped: question.key,
        currentQuestion: question.key,
        answered: countAnswered(nextContent),
        total,
        content: nextContent,
      });
    }

    // Still within the 10-minute window for this question -- nothing to
    // persist (the clock start was already saved above), the client will
    // call again shortly and this same model gets retried.
    return NextResponse.json({
      done: false,
      waiting: true,
      answered: countAnswered(content),
      total,
      currentQuestion: question.key,
      model,
      elapsedMs,
      timeoutMs: QUESTION_TIMEOUT_MS,
      content,
    });
  }
}
