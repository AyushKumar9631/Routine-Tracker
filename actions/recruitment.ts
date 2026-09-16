"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextRoundNo } from "@/lib/recruitment";
import {
  COMPANY_OVERVIEW_QUESTIONS,
  ROUND_PREP_QUESTIONS,
  initialContent,
  resetSkippedToUnattempted,
  withMissingQuestionsFilled,
  type QuestionRecord,
} from "@/lib/ai/recruitment-research";
import type {
  FinalOutcome,
  InsightKind,
  RecruitmentFormInput,
  RecruitmentRound,
  RoundResult,
  RoundType,
} from "@/lib/types";

/**
 * Ensures a recruitment_ai_insights row exists and is ready for the H7
 * stepper to work on, for one (activityId, kind, roundId) research pass.
 * Two very different callers rely on this doing the right thing in each
 * case:
 *  - Drive/round creation (below): the row almost certainly doesn't exist
 *    yet, so this just inserts a fresh "nothing attempted" one.
 *  - The client research panel, both on mount (auto-resume) and on a
 *    manual Start research/Retry click: the row usually already exists,
 *    maybe partway through a previous run. This resets anything "skipped"
 *    (abandoned to an earlier run's 10-minute-per-question ceiling — see
 *    lib/ai/recruitment-research.ts) back to "unattempted" and clears any
 *    stepping progress/halt, so a fresh run starts clean. Anything already
 *    "resolved" or confirmed "unknown" is left exactly as-is — this is the
 *    "checks which questions has already been answered and doesn't produce
 *    answers of those questions again" rule from the task, and it's also
 *    why a single function safely serves both "start fresh" and "resume"
 *    callers: there's nothing to reset on a truly fresh row anyway.
 *  - Either way, an already-`ready` row (fully answered) is left completely
 *    untouched — there's nothing to resume and nothing to reset.
 *
 * BUGFIX HISTORY: this replaces both the old `triggerRecruitmentEnrich`
 * (H3: fire-and-forget fetch scheduled via next/server's `after()`, working
 * around the fact that an un-awaited fetch inside a Server Action gets cut
 * off by Vercel once the response is sent) and the old `retryRecruitmentInsight`
 * (which re-fired that same fetch). Both existed because the old
 * app/api/ai/recruitment-enrich route actually ran a whole pass's worth of
 * Groq calls, which was slow enough to need backgrounding. H7 moved all the
 * actual Groq calling into the client-driven step endpoint
 * (app/api/ai/recruitment-enrich/step) — all THIS function does now is a
 * couple of fast DB reads/writes, so there's no more need to defer it at
 * all. It's just awaited, like every other action in this file.
 */
export async function ensureRecruitmentInsight(
  activityId: string,
  kind: InsightKind,
  roundId?: string
): Promise<{ insightId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: details, error: detailsError } = await supabase
    .from("recruitment_details")
    .select("activity_id")
    .eq("activity_id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (detailsError) throw new Error(detailsError.message);
  if (!details) throw new Error("Recruitment drive not found");

  if (kind === "round_prep") {
    if (!roundId) throw new Error("roundId is required for round_prep");
    const { data: round, error: roundError } = await supabase
      .from("recruitment_rounds")
      .select("id")
      .eq("id", roundId)
      .eq("activity_id", activityId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (roundError) throw new Error(roundError.message);
    if (!round) throw new Error("Round not found");
  }

  const questions = kind === "company_overview" ? COMPANY_OVERVIEW_QUESTIONS : ROUND_PREP_QUESTIONS;

  let query = supabase.from("recruitment_ai_insights").select("id, status, content").eq("activity_id", activityId).eq("kind", kind);
  query = kind === "round_prep" ? query.eq("round_id", roundId as string) : query.is("round_id", null);
  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    if (existing.status === "ready") return { insightId: existing.id };

    const resetContent = resetSkippedToUnattempted(
      withMissingQuestionsFilled(questions, existing.content as Record<string, QuestionRecord> | null)
    );
    const { error: updateError } = await supabase
      .from("recruitment_ai_insights")
      .update({ content: resetContent, progress: null, status: "pending", error: null })
      .eq("id", existing.id);
    if (updateError) throw new Error(updateError.message);
    return { insightId: existing.id };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("recruitment_ai_insights")
    .insert({
      activity_id: activityId,
      user_id: user.id,
      round_id: kind === "round_prep" ? roundId : null,
      kind,
      status: "pending",
      content: initialContent(questions),
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  return { insightId: inserted.id };
}

export async function createRecruitmentActivity(input: RecruitmentFormInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const companyName = input.company_name.trim();
  const role = input.role.trim();
  if (!companyName) throw new Error("Company name is required");
  if (!role) throw new Error("Role is required");

  const companyUrl = input.company_url.trim() || null;
  const testDate = input.test_date || null;

  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .insert({
      user_id: user.id,
      name: `${companyName} \u2014 ${role}`,
      icon: "\ud83c\udfaf",
      kind: "recruitment",
      // period/completion_type are left at their table defaults ("daily" /
      // "boolean") purely to satisfy the existing NOT NULL constraints — a
      // recruitment-kind activity must never have these read by the app.
    })
    .select("id")
    .single();

  if (activityError) throw new Error(activityError.message);

  // From here on, if either insert below fails we'd otherwise be left with
  // an orphaned activities row (kind = "recruitment" with no
  // recruitment_details to go with it) that every recruitment query assumes
  // exists — clean it back up rather than leave that half-created.
  try {
    const { error: detailsError } = await supabase.from("recruitment_details").insert({
      activity_id: activity.id,
      user_id: user.id,
      company_name: companyName,
      company_url: companyUrl,
      role,
    });
    if (detailsError) throw new Error(detailsError.message);

    const { data: round1, error: roundError } = await supabase
      .from("recruitment_rounds")
      .insert({
        activity_id: activity.id,
        user_id: user.id,
        round_no: 1,
        round_type: input.round_type,
        test_date: testDate,
      })
      .select("id")
      .single();
    if (roundError) throw new Error(roundError.message);

    // Best-effort: a hiccup creating these placeholder rows shouldn't sink
    // drive creation (the client research panel's own ensureRecruitmentInsight
    // call, on mount, is a second chance to create them) — but it's worth
    // doing here too so the very first render of the detail page already
    // shows "0 of 5" instead of a flash of "not researched yet".
    try {
      await ensureRecruitmentInsight(activity.id, "company_overview");
      await ensureRecruitmentInsight(activity.id, "round_prep", round1.id);
    } catch (err) {
      console.error("createRecruitmentActivity: ensureRecruitmentInsight failed", err);
    }
  } catch (err) {
    await supabase.from("activities").delete().eq("id", activity.id);
    throw err;
  }

  revalidatePath("/");
  revalidatePath("/activities");
}

/**
 * Sets a round's test date once the user actually has one — per 1.4 this is
 * only ever called from the "no date yet" state (the inline control that
 * calls this doesn't render once a date is already set), so there's no
 * "clear the date" path here.
 */
export async function setRoundTestDate(roundId: string, testDate: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (!testDate) throw new Error("A date is required");

  const { error } = await supabase
    .from("recruitment_rounds")
    .update({ test_date: testDate })
    .eq("id", roundId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/activities");
}

/**
 * Logs a result on a round, implementing the branch in plan section 1.4
 * exactly:
 * - confident / not_sure: self-assessment only — store it and stop. The
 *   round stays open (not terminal), the drive stays active, and the user
 *   can come back and re-log this same round to rejected/passed later.
 * - rejected: closes the whole drive (recruitment_details.status='done',
 *   final_outcome='rejected') — it drops out of Today from now on.
 * - passed: just records the result. It deliberately does NOT touch
 *   recruitment_details or insert a new round — the "another round, or
 *   done?" follow-up is two distinct user actions (addNextRound /
 *   markDriveDone below), not an automatic side effect of logging "passed".
 *   Today re-renders this same drive with round.result='passed' in the
 *   meantime, which recruitment-row.tsx uses to show that follow-up prompt
 *   instead of the usual countdown/log-result UI.
 */
export async function submitRoundResult(roundId: string, result: RoundResult) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (result === "awaiting") throw new Error("'awaiting' isn't a result that can be logged");

  const { data: round, error: roundError } = await supabase
    .from("recruitment_rounds")
    .select("id, activity_id")
    .eq("id", roundId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (roundError) throw new Error(roundError.message);
  if (!round) throw new Error("Round not found");

  const { error: updateError } = await supabase
    .from("recruitment_rounds")
    .update({ result })
    .eq("id", roundId)
    .eq("user_id", user.id);
  if (updateError) throw new Error(updateError.message);

  if (result === "rejected") {
    const { error: detailsError } = await supabase
      .from("recruitment_details")
      .update({ status: "done", final_outcome: "rejected" })
      .eq("activity_id", round.activity_id)
      .eq("user_id", user.id);
    if (detailsError) throw new Error(detailsError.message);
  }

  revalidatePath("/");
  revalidatePath("/activities");
}

/**
 * The "another round" branch of the passed-round follow-up: inserts the
 * next round (round_no = previous + 1) and leaves the drive active. Becomes
 * the new current round on Today.
 */
export async function addNextRound(activityId: string, roundType: RoundType, testDate?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existingRounds, error: roundsError } = await supabase
    .from("recruitment_rounds")
    .select("*")
    .eq("activity_id", activityId)
    .eq("user_id", user.id);
  if (roundsError) throw new Error(roundsError.message);

  const roundNo = nextRoundNo((existingRounds ?? []) as RecruitmentRound[]);

  const { data: newRound, error: insertError } = await supabase
    .from("recruitment_rounds")
    .insert({
      activity_id: activityId,
      user_id: user.id,
      round_no: roundNo,
      round_type: roundType,
      test_date: testDate || null,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  // Best-effort, same reasoning as createRecruitmentActivity above — company
  // overview is already ready by this point so only round prep needs a
  // fresh placeholder row.
  try {
    await ensureRecruitmentInsight(activityId, "round_prep", newRound.id);
  } catch (err) {
    console.error("addNextRound: ensureRecruitmentInsight failed", err);
  }

  revalidatePath("/");
  revalidatePath("/activities");
}

/**
 * The "done" branch of the passed-round follow-up (also usable for any
 * other terminal outcome later, e.g. a manually-withdrawn drive — the plan
 * only wires "offer" up to UI in this task, but the action itself doesn't
 * need to assume that's the only outcome it'll ever be called with).
 */
export async function markDriveDone(activityId: string, outcome: FinalOutcome) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("recruitment_details")
    .update({ status: "done", final_outcome: outcome })
    .eq("activity_id", activityId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/activities");
}
