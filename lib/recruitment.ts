// Recruitment Tracker — pure helpers only, no DB or fetch calls, so these are
// trivial to unit test (mirrors the style of lib/deadlines.ts).
//
// Vocabulary reminder (see the plan doc's glossary, section 1.2): a "round"
// here always means an *interview round* (recruitment_rounds row) — never an
// "AI pass" (company overview / round prep), which is a separate concept.

import type { RecruitmentRound, RoundResult, RoundType } from "./types";

export const ROUND_TYPE_LABELS: Record<RoundType, string> = {
  oa: "OA",
  communication: "Communication",
  technical: "Technical",
  hr: "HR",
  other: "Other",
};

export const RESULT_LABELS: Record<RoundResult, string> = {
  awaiting: "Awaiting",
  confident: "Confident (pending)",
  not_sure: "Not sure (pending)",
  rejected: "Rejected",
  passed: "Passed",
};

/**
 * Terminal results end the round for good: `rejected` closes the whole drive,
 * `passed` moves on to another round or closes the drive as an offer. Neither
 * can be re-logged afterwards.
 */
export function isTerminalResult(result: RoundResult): boolean {
  return result === "rejected" || result === "passed";
}

/**
 * `confident` / `not_sure` are the user's own read on how a round went while
 * the *official* result isn't out yet — the round stays open (not terminal)
 * and can still be re-logged later to `rejected` or `passed` once the real
 * result is known.
 */
export function isSelfAssessment(result: RoundResult): boolean {
  return result === "confident" || result === "not_sure";
}

/** Rounds sorted oldest-first (round_no ascending) — for detail/history views. */
export function sortRounds(rounds: RecruitmentRound[]): RecruitmentRound[] {
  return [...rounds].sort((a, b) => a.round_no - b.round_no);
}

/**
 * The round currently "in play" for a drive: the highest round_no. Today's
 * page and the detail page both act on this one round; every earlier round
 * is read-only history by definition (it was already passed to get here).
 */
export function currentRound(rounds: RecruitmentRound[]): RecruitmentRound | undefined {
  if (rounds.length === 0) return undefined;
  return rounds.reduce((latest, r) => (r.round_no > latest.round_no ? r : latest));
}

/** round_no to use for a newly-added round (1 if this is the very first). */
export function nextRoundNo(rounds: RecruitmentRound[]): number {
  const current = currentRound(rounds);
  return current ? current.round_no + 1 : 1;
}
