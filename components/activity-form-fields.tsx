"use client";

import type { ActivityFormInput, CompletionType, Period } from "@/lib/types";
import { DAY_NAMES } from "@/lib/types";

export function ActivityFormFields({
  value,
  onChange,
}: {
  value: ActivityFormInput;
  onChange: (patch: Partial<ActivityFormInput>) => void;
}) {
  const isLeetcode = value.automation_type === "leetcode_potd";
  const isGfg = value.automation_type === "gfg_potd";
  const isAutomated = isLeetcode || isGfg;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="w-16">
          <label className="field-label">Icon</label>
          <input
            className="field-input text-center"
            value={value.icon}
            maxLength={2}
            onChange={(e) => onChange({ icon: e.target.value })}
          />
        </div>
        <div className="flex-1">
          <label className="field-label">Name</label>
          <input
            className="field-input"
            placeholder="e.g. Five git commits"
            required
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="field-label">Notes (optional)</label>
        <textarea
          className="field-input min-h-[64px] resize-y"
          placeholder="Any context worth remembering about this activity"
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <div>
        <label className="field-label">Automation</label>
        <select
          className="field-input"
          value={value.automation_type}
          onChange={(e) => {
            const automation_type = e.target.value as "none" | "leetcode_potd" | "gfg_potd";
            onChange(
              automation_type === "none"
                ? { automation_type }
                : { automation_type, period: "daily", completion_type: "boolean" }
            );
          }}
        >
          <option value="none">None &mdash; log it myself</option>
          <option value="leetcode_potd">LeetCode Daily Challenge</option>
          <option value="gfg_potd">GFG Problem of the Day</option>
        </select>
      </div>

      {isLeetcode && (
        <div>
          <label className="field-label">LeetCode username</label>
          <input
            className="field-input"
            placeholder="e.g. jsmith123"
            required
            value={value.leetcode_username}
            onChange={(e) => onChange({ leetcode_username: e.target.value })}
          />
          <p className="mt-1 text-xs text-ink-soft">
            Public profile only &mdash; no password needed. Runs daily and marks itself
            complete once you&apos;ve solved today&apos;s problem.
          </p>
        </div>
      )}

      {isGfg && (
        <div>
          <label className="field-label">GFG username</label>
          <input
            className="field-input"
            placeholder="e.g. jsmith123"
            required
            value={value.gfg_username}
            onChange={(e) => onChange({ gfg_username: e.target.value })}
          />
          <p className="mt-1 text-xs text-ink-soft">
            Public profile only. GFG doesn&apos;t expose per-problem data, so this tracks
            your public POTD streak counter instead &mdash; the first check just sets a
            baseline, and it starts marking itself complete from the next streak
            increase onward.
          </p>
        </div>
      )}

      {!isAutomated && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Repeats</label>
              <select
                className="field-input"
                value={value.period}
                onChange={(e) => onChange({ period: e.target.value as Period })}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {(value.period === "weekly" || value.period === "biweekly") && (
              <div>
                <label className="field-label">On</label>
                <select
                  className="field-input"
                  value={value.schedule_day_of_week ?? 1}
                  onChange={(e) => onChange({ schedule_day_of_week: Number(e.target.value) })}
                >
                  {DAY_NAMES.map((day, i) => (
                    <option key={day} value={i}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {value.period === "monthly" && (
              <div>
                <label className="field-label">Day of month</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="field-input"
                  value={value.schedule_day_of_month ?? 1}
                  onChange={(e) => onChange({ schedule_day_of_month: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          {value.period === "biweekly" && (
            <div>
              <label className="field-label">Starting the week of</label>
              <input
                type="date"
                className="field-input"
                value={value.anchor_date ?? ""}
                onChange={(e) => onChange({ anchor_date: e.target.value })}
              />
              <p className="mt-1 text-xs text-ink-soft">
                Used to work out which weeks it&apos;s due, every other week from here.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Completion</label>
              <select
                className="field-input"
                value={value.completion_type}
                onChange={(e) => onChange({ completion_type: e.target.value as CompletionType })}
              >
                <option value="boolean">Done / not done</option>
                <option value="count">Hits a number</option>
              </select>
            </div>

            {value.completion_type === "count" && (
              <div>
                <label className="field-label">Target</label>
                <input
                  type="number"
                  min={1}
                  className="field-input"
                  placeholder="5"
                  value={value.target_value ?? ""}
                  onChange={(e) =>
                    onChange({
                      target_value: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            )}
          </div>

          {value.completion_type === "count" && (
            <div>
              <label className="field-label">Unit (optional)</label>
              <input
                className="field-input"
                placeholder="commits, problems, pages\u2026"
                value={value.unit_label}
                onChange={(e) => onChange({ unit_label: e.target.value })}
              />
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-3">
        <label className="field-label mb-0">Color</label>
        <input
          type="color"
          className="h-8 w-8 cursor-pointer rounded border border-line bg-card"
          value={value.color}
          onChange={(e) => onChange({ color: e.target.value })}
        />
      </div>
    </div>
  );
}
