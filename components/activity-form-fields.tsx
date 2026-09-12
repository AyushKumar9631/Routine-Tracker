"use client";

import type { ActivityFormInput, CompletionType, Period } from "@/lib/types";
import { DAY_NAMES } from "@/lib/types";
import { ScreentimeSetupPanel } from "@/components/screentime-setup-panel";
import { ActivityIcon } from "@/components/activity-icon";
import { DEFAULT_NOTIFICATION_TEMPLATE, DEFAULT_GFG_NOTIFICATION_TEMPLATE } from "@/lib/notification-template";
import { automationDefaults } from "@/lib/utils";

export function ActivityFormFields({
  value,
  onChange,
  hideAutomationPicker = false,
}: {
  value: ActivityFormInput;
  onChange: (patch: Partial<ActivityFormInput>) => void;
  /** Skip the "Automation" dropdown — used once a template has already fixed it. */
  hideAutomationPicker?: boolean;
}) {
  const isLeetcode = value.automation_type === "leetcode_potd";
  const isGfg = value.automation_type === "gfg_potd";
  const isScreenTime = value.automation_type === "screen_time";
  const isAutomated = isLeetcode || isGfg || isScreenTime;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="w-40">
          <label className="field-label">Icon</label>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line bg-paper text-lg">
              <ActivityIcon icon={value.icon} />
            </span>
            <input
              className="field-input"
              placeholder="\u2713 or image URL"
              value={value.icon}
              onChange={(e) => onChange({ icon: e.target.value })}
            />
          </div>
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

      {!hideAutomationPicker && (
        <div>
          <label className="field-label">Automation</label>
          <select
            className="field-input"
            value={value.automation_type}
            onChange={(e) => {
              const automation_type = e.target.value as ActivityFormInput["automation_type"];
              onChange(automationDefaults(automation_type));
            }}
          >
            <option value="none">None &mdash; log it myself</option>
            <option value="leetcode_potd">LeetCode Daily Challenge</option>
            <option value="gfg_potd">GFG Problem of the Day</option>
            <option value="screen_time">Smartphone Screen Time</option>
          </select>
        </div>
      )}

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

          <div className="mt-3">
            <label className="field-label">Complete by (optional)</label>
            <input
              type="time"
              className="field-input"
              value={value.preferred_complete_by ?? ""}
              onChange={(e) =>
                onChange({ preferred_complete_by: e.target.value === "" ? null : e.target.value })
              }
            />
            <p className="mt-1 text-xs text-ink-soft">
              Get a nudge if it&apos;s still unsolved by this time. Leave blank to default to
              2 hours before the midnight deadline.
            </p>
          </div>

          <div className="mt-3">
            <label className="field-label">Notification message (optional)</label>
            <textarea
              className="field-input min-h-[64px] resize-y"
              placeholder={DEFAULT_NOTIFICATION_TEMPLATE}
              value={value.notification_template ?? ""}
              onChange={(e) =>
                onChange({ notification_template: e.target.value === "" ? null : e.target.value })
              }
            />
            <p className="mt-1 text-xs text-ink-soft">
              Leave blank to use the default above. Variables you can use:{" "}
              <code className="rounded bg-paper px-1 py-0.5">{"{question}"}</code>,{" "}
              <code className="rounded bg-paper px-1 py-0.5">{"{number}"}</code>,{" "}
              <code className="rounded bg-paper px-1 py-0.5">{"{difficulty}"}</code>.
            </p>
          </div>
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

          <div className="mt-3">
            <label className="field-label">Complete by (optional)</label>
            <input
              type="time"
              className="field-input"
              value={value.preferred_complete_by ?? ""}
              onChange={(e) =>
                onChange({ preferred_complete_by: e.target.value === "" ? null : e.target.value })
              }
            />
            <p className="mt-1 text-xs text-ink-soft">
              Get a nudge if it&apos;s still unsolved by this time. Leave blank to default to
              2 hours before the midnight deadline.
            </p>
          </div>

          <div className="mt-3">
            <label className="field-label">Notification message (optional)</label>
            <textarea
              className="field-input min-h-[64px] resize-y"
              placeholder={DEFAULT_GFG_NOTIFICATION_TEMPLATE}
              value={value.notification_template ?? ""}
              onChange={(e) =>
                onChange({ notification_template: e.target.value === "" ? null : e.target.value })
              }
            />
            <p className="mt-1 text-xs text-ink-soft">
              Leave blank to use the default above. GFG doesn&apos;t expose the POTD&apos;s
              name or difficulty (see the username note above), so the only variable
              available is <code className="rounded bg-paper px-1 py-0.5">{"{streak}"}</code>.
            </p>
          </div>
        </div>
      )}

      {isScreenTime && (
        <div>
          <label className="field-label">Phone</label>
          <select
            className="field-input"
            required
            value={value.screentime_platform ?? ""}
            onChange={(e) =>
              onChange({ screentime_platform: e.target.value as "ios" | "android" })
            }
          >
            <option value="" disabled>
              Choose your phone&hellip;
            </option>
            <option value="ios">iPhone</option>
            <option value="android" disabled>
              Android &mdash; coming soon
            </option>
          </select>

          {value.screentime_platform === "ios" ? (
            <p className="mt-1 text-xs text-ink-soft">
              Uses the Jomo app + an iOS Shortcut to push your daily screen time here. The
              webhook link shows up on this activity&apos;s page once it&apos;s saved.{" "}
              <ScreentimeSetupPanel
                triggerLabel="Preview the setup steps"
                triggerClassName="underline underline-offset-2 hover:text-ink"
              />
            </p>
          ) : (
            <p className="mt-1 text-xs text-amber">
              Android screen time automation isn&apos;t built yet &mdash; iPhone is the only
              option for now.
            </p>
          )}

          <div className="mt-3">
            <label className="field-label">Daily budget, in minutes (optional)</label>
            <input
              type="number"
              min={1}
              className="field-input"
              placeholder="e.g. 120"
              value={value.target_value ?? ""}
              onChange={(e) =>
                onChange({
                  target_value: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <p className="mt-1 text-xs text-ink-soft">
              Colors today&apos;s gauge &mdash; green under 80% of this, amber up to 110%, red
              beyond. Every synced day still logs as done regardless of budget.
            </p>
          </div>
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
