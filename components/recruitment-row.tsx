"use client";

import { useEffect, useState, useTransition } from "react";
import { addNextRound, markDriveDone, setRoundTestDate, submitRoundResult } from "@/actions/recruitment";
import { RecruitmentCountdownBadge, useRecruitmentCountdown } from "@/components/recruitment-countdown";
import { isSelfAssessment, RESULT_LABELS, ROUND_TYPE_LABELS } from "@/lib/recruitment";
import type { Activity, RecruitmentDetails, RecruitmentRound, RoundResult, RoundType } from "@/lib/types";
import { todayKey } from "@/lib/utils";

const LOG_RESULT_OPTIONS: { value: RoundResult; label: string }[] = [
  { value: "confident", label: "Confident" },
  { value: "not_sure", label: "Not sure" },
  { value: "rejected", label: "Rejected" },
  { value: "passed", label: "Passed" },
];

// Duplicated from recruitment-form-fields.tsx rather than shared — that
// file isn't in this task's file list, so this stays a small local copy
// rather than reaching in to hoist a shared export.
const ROUND_TYPE_OPTIONS: RoundType[] = ["oa", "communication", "technical", "hr", "other"];

/**
 * One active drive's current round on the Today page. Two layouts, chosen
 * purely from server truth (round.result), so they hold up across a page
 * reload and not just within one session:
 *
 * - Normal state (result is "awaiting", "confident", or "not_sure"): company/
 *   role/round badge, the date-setter or countdown, and the always-visible
 *   "Log result" action from 1.4. A "rejected" result is never seen here —
 *   it flips recruitment_details.status to "done" server-side, so the drive
 *   drops out of Today's active-drives query entirely before this component
 *   would ever render it with that result.
 * - Passed-and-unresolved state (result === "passed"): the drive is still
 *   active but this round is done, so the row swaps to the "another round,
 *   or done?" follow-up from 1.4 instead of the countdown/log-result UI.
 */
export function RecruitmentRow({
  activity,
  details,
  round,
}: {
  activity: Activity;
  details: RecruitmentDetails;
  round: RecruitmentRound;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [dateInput, setDateInput] = useState(round.test_date ?? "");
  const [showResultOptions, setShowResultOptions] = useState(false);

  const [showAddRoundForm, setShowAddRoundForm] = useState(false);
  const [nextRoundType, setNextRoundType] = useState<RoundType>("oa");
  const [nextTestDate, setNextTestDate] = useState("");

  const countdown = useRecruitmentCountdown(round.test_date);

  // This component doesn't remount when addNextRound swaps in a new current
  // round (same activity.id key in the parent list) — resync local UI state
  // whenever the round identity actually changes, so a stale date/expanded
  // panel from the previous round doesn't linger.
  useEffect(() => {
    setDateInput(round.test_date ?? "");
    setShowResultOptions(false);
    setShowAddRoundForm(false);
    setError(null);
  }, [round.id, round.test_date]);

  function handleSetDate() {
    if (!dateInput) return;
    setError(null);
    startTransition(async () => {
      try {
        await setRoundTestDate(round.id, dateInput);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save date");
      }
    });
  }

  function handleSubmitResult(value: RoundResult) {
    setError(null);
    startTransition(async () => {
      try {
        await submitRoundResult(round.id, value);
        setShowResultOptions(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to log result");
      }
    });
  }

  function handleAddNextRound() {
    setError(null);
    startTransition(async () => {
      try {
        await addNextRound(activity.id, nextRoundType, nextTestDate || undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add round");
      }
    });
  }

  function handleMarkDone() {
    setError(null);
    startTransition(async () => {
      try {
        await markDriveDone(activity.id, "offer");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to mark drive done");
      }
    });
  }

  return (
    <li className="border-b border-line py-4 last:border-b-0" data-activity-id={activity.id}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink">
            {details.company_url ? (
              <a
                href={details.company_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-2"
              >
                {details.company_name}
              </a>
            ) : (
              details.company_name
            )}
            <span className="text-ink-soft"> &mdash; {details.role}</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Round {round.round_no} &middot; {ROUND_TYPE_LABELS[round.round_type]}
            {isSelfAssessment(round.result) && (
              <span className="text-ink"> &middot; {RESULT_LABELS[round.result]}</span>
            )}
          </p>
        </div>

        {round.result !== "passed" && round.test_date && <RecruitmentCountdownBadge {...countdown} />}
      </div>

      {round.result === "passed" ? (
        <div className="mt-3 rounded border border-line bg-card px-3 py-3">
          <p className="text-xs text-ink">Passed this round &mdash; add another round, or mark it done?</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddRoundForm((v) => !v)}
              disabled={isPending}
              className="rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:border-moss hover:text-ink disabled:opacity-50"
            >
              {showAddRoundForm ? "Cancel" : "Add another round"}
            </button>
            <button
              type="button"
              onClick={handleMarkDone}
              disabled={isPending}
              className="rounded bg-moss px-2 py-1 text-xs text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Saving\u2026" : "Mark drive done (offer)"}
            </button>
          </div>

          {showAddRoundForm && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="field-label">Round type</label>
                <select
                  className="field-input"
                  value={nextRoundType}
                  onChange={(e) => setNextRoundType(e.target.value as RoundType)}
                  disabled={isPending}
                >
                  {ROUND_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {ROUND_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-40">
                <label className="field-label">Test date (optional)</label>
                <input
                  type="date"
                  className="field-input"
                  min={todayKey()}
                  value={nextTestDate}
                  onChange={(e) => setNextTestDate(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <button
                type="button"
                onClick={handleAddNextRound}
                disabled={isPending}
                className="rounded bg-moss px-3 py-2 text-xs text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? "Adding\u2026" : "Add round"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {!round.test_date && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="w-40">
                <input
                  type="date"
                  className="field-input"
                  min={todayKey()}
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <button
                type="button"
                onClick={handleSetDate}
                disabled={isPending || !dateInput}
                className="rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:border-moss hover:text-ink disabled:opacity-50"
              >
                {isPending ? "Saving\u2026" : "Save date"}
              </button>
              <span className="text-xs text-ink-soft">
                optional &mdash; leave blank and Today will keep asking
              </span>
            </div>
          )}

          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowResultOptions((v) => !v)}
              disabled={isPending}
              className="rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:border-moss hover:text-ink disabled:opacity-50"
            >
              {showResultOptions ? "Hide result options" : "Log result"}
            </button>

            {showResultOptions && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {LOG_RESULT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSubmitResult(option.value)}
                    disabled={isPending}
                    className="rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:border-moss hover:text-ink disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {error && <p className="mt-2 text-xs text-rust">{error}</p>}
    </li>
  );
}
