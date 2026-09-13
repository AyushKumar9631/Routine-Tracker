"use client";

import { useState } from "react";
import { RecruitmentCountdownBadge, useRecruitmentCountdown } from "@/components/recruitment-countdown";
import { ROUND_TYPE_LABELS } from "@/lib/recruitment";
import type { Activity, RecruitmentDetails, RecruitmentRound, RoundResult } from "@/lib/types";
import { todayKey } from "@/lib/utils";

const LOG_RESULT_OPTIONS: { value: RoundResult; label: string }[] = [
  { value: "confident", label: "Confident" },
  { value: "not_sure", label: "Not sure" },
  { value: "rejected", label: "Rejected" },
  { value: "passed", label: "Passed" },
];

/**
 * One active drive's current round on the Today page: company/role/round
 * badge, then either the inline date-setter (no test_date yet) or the
 * multi-day countdown (test_date set), plus the always-visible "Log result"
 * action from plan section 1.4.
 *
 * The date-setter and result buttons are visual/interactive shells only —
 * `setRoundTestDate` / `submitRoundResult` / `addNextRound` / `markDriveDone`
 * are Task C3's job (see the plan's C2/C3 split), so both are wired to
 * disabled stubs marked with `TODO(Task C3)` at the exact swap points,
 * mirroring how Task B1 left its Save button disabled for B2.
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
  const [dateInput, setDateInput] = useState(round.test_date ?? "");
  const [showResultOptions, setShowResultOptions] = useState(false);

  const countdown = useRecruitmentCountdown(round.test_date);

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
          </p>
        </div>

        {round.test_date && <RecruitmentCountdownBadge {...countdown} />}
      </div>

      {!round.test_date && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="w-40">
            <input
              type="date"
              className="field-input"
              min={todayKey()}
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
            />
          </div>
          {/*
            TODO(Task C3): wire to setRoundTestDate(round.id, dateInput).
            Leaving this disabled for now — per 1.4 an unset date is fine and
            non-blocking, so there's nothing broken about shipping the input
            without a working Save yet.
          */}
          <button
            type="button"
            disabled
            title="Wiring lands in Task C3"
            className="rounded border border-line px-2 py-1 text-xs text-ink-soft opacity-50"
          >
            Save date
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
          className="rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:border-moss hover:text-ink"
        >
          {showResultOptions ? "Hide result options" : "Log result"}
        </button>

        {showResultOptions && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {LOG_RESULT_OPTIONS.map((option) => (
              /*
                TODO(Task C3): wire to submitRoundResult(round.id, option.value).
                "passed" additionally needs the "another round or done?"
                follow-up prompt from 1.4 (addNextRound / markDriveDone) —
                that's C3's job too, not built here.
              */
              <button
                key={option.value}
                type="button"
                disabled
                title="Wiring lands in Task C3"
                className="rounded border border-line px-2 py-1 text-xs text-ink-soft opacity-50"
              >
                {option.label}
              </button>
            ))}
            <span className="text-xs text-ink-soft">submit wires up in Task C3</span>
          </div>
        )}
      </div>
    </li>
  );
}
