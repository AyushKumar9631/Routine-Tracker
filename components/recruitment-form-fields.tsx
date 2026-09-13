"use client";

import type { RecruitmentFormInput, RoundType } from "@/lib/types";
import { ROUND_TYPE_LABELS } from "@/lib/recruitment";

const ROUND_TYPE_OPTIONS: RoundType[] = ["oa", "communication", "technical", "hr", "other"];

/**
 * Creation-time fields for a recruitment drive: company + role + round 1.
 * Deliberately separate from ActivityFormFields — recruitment activities
 * don't have a period/schedule/completion_type, so there's nothing to share.
 */
export function RecruitmentFormFields({
  value,
  onChange,
}: {
  value: RecruitmentFormInput;
  onChange: (patch: Partial<RecruitmentFormInput>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="field-label">Company name</label>
        <input
          className="field-input"
          placeholder="e.g. Acme Corp"
          required
          value={value.company_name}
          onChange={(e) => onChange({ company_name: e.target.value })}
        />
      </div>

      <div>
        <label className="field-label">Company URL (optional)</label>
        <input
          type="url"
          className="field-input"
          placeholder="https://acme.com"
          value={value.company_url}
          onChange={(e) => onChange({ company_url: e.target.value })}
        />
        <p className="mt-1 text-xs text-ink-soft">
          Helps the AI research pull up the right company &mdash; safe to leave blank.
        </p>
      </div>

      <div>
        <label className="field-label">Role</label>
        <input
          className="field-input"
          placeholder="e.g. SDE Intern"
          required
          value={value.role}
          onChange={(e) => onChange({ role: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Round 1 type</label>
          <select
            className="field-input"
            value={value.round_type}
            onChange={(e) => onChange({ round_type: e.target.value as RoundType })}
          >
            {ROUND_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {ROUND_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label">Test date (optional)</label>
          <input
            type="date"
            className="field-input"
            value={value.test_date}
            onChange={(e) => onChange({ test_date: e.target.value })}
          />
        </div>
      </div>

      <p className="text-xs text-ink-soft">
        Don&apos;t have a date yet? Leave it blank &mdash; Today will ask again once
        you have one, and you can log a result any time regardless.
      </p>
    </div>
  );
}
