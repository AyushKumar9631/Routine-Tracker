"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextRoundNo } from "@/lib/recruitment";
import type {
  FinalOutcome,
  RecruitmentFormInput,
  RecruitmentRound,
  RoundResult,
  RoundType,
} from "@/lib/types";

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

    const { error: roundError } = await supabase.from("recruitment_rounds").insert({
      activity_id: activity.id,
      user_id: user.id,
      round_no: 1,
      round_type: input.round_type,
      test_date: testDate,
    });
    if (roundError) throw new Error(roundError.message);
  } catch (err) {
    await supabase.from("activities").delete().eq("id", activity.id);
    throw err;
  }

  // TODO(Phase F): trigger the AI research passes here — company overview
  // (round_id = null) and round prep for this round 1 — fire-and-forget, must
  // not block this action's return. See plan doc section 1.6 / task F3.

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

  const { error: insertError } = await supabase.from("recruitment_rounds").insert({
    activity_id: activityId,
    user_id: user.id,
    round_no: roundNo,
    round_type: roundType,
    test_date: testDate || null,
  });
  if (insertError) throw new Error(insertError.message);

  // TODO(Phase F): trigger round-prep AI pass here — for this new round
  // (kind='round_prep', round_id = the row just inserted) — fire-and-forget,
  // must not block this action's return. See plan doc section 1.6 / task F3.

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
