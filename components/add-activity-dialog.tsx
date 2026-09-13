"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ActivityFormFields } from "@/components/activity-form-fields";
import { RecruitmentFormFields } from "@/components/recruitment-form-fields";
import { createActivity } from "@/actions/activities";
import { defaultActivityForm, defaultRecruitmentForm, automationDefaults } from "@/lib/utils";
import type { ActivityFormInput, RecruitmentFormInput } from "@/lib/types";

type AutomationType = ActivityFormInput["automation_type"];
type Kind = "routine" | "recruitment";

const TEMPLATES: { type: AutomationType; icon: string; title: string; description: string }[] = [
  {
    type: "none",
    icon: "\u270d\ufe0f",
    title: "General",
    description: "Any habit on your own schedule \u2014 daily, weekly, biweekly, or monthly.",
  },
  {
    type: "leetcode_potd",
    icon: "\ud83e\udde9",
    title: "LeetCode Daily",
    description: "Auto-tracked from your public profile. Marks itself done when you solve today's problem.",
  },
  {
    type: "gfg_potd",
    icon: "\ud83d\udcd7",
    title: "GFG POTD",
    description: "Auto-tracked from your public streak counter on GeeksforGeeks.",
  },
  {
    type: "screen_time",
    icon: "\ud83d\udcf1",
    title: "Screen Time",
    description: "Synced daily from your iPhone via a Shortcut. Stay under your budget.",
  },
];

// Not an automation template — a recruitment drive is a different `kind` of
// activity entirely (see lib/types.ts), so it isn't part of TEMPLATES above
// and doesn't reuse ActivityFormFields. Rendered as one extra tile in the
// same template grid.
const RECRUITMENT_TEMPLATE = {
  icon: "\ud83c\udfaf",
  title: "Recruitment Drive",
  description:
    "Track a company's internship/full-time process round by round, with reminders before each test.",
};

export function AddActivityDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"template" | "details">("template");
  const [kind, setKind] = useState<Kind>("routine");
  const [value, setValue] = useState<ActivityFormInput>(defaultActivityForm());
  const [recruitmentValue, setRecruitmentValue] = useState<RecruitmentFormInput>(
    defaultRecruitmentForm()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setOpen(false);
    setStep("template");
    setKind("routine");
    setValue(defaultActivityForm());
    setRecruitmentValue(defaultRecruitmentForm());
    setError("");
  }

  function chooseTemplate(type: AutomationType) {
    setKind("routine");
    setValue((v) => ({ ...v, ...automationDefaults(type) }));
    setStep("details");
  }

  function chooseRecruitmentTemplate() {
    setKind("recruitment");
    setRecruitmentValue(defaultRecruitmentForm());
    setStep("details");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (kind === "recruitment") {
      // TODO(Task B2): call createRecruitmentActivity(recruitmentValue) here
      // and close() on success, the same way the routine branch below does.
      // The Save button is disabled while this is a TODO (see the button's
      // `disabled` below), so this branch isn't reachable yet — guarded
      // anyway in case that changes.
      return;
    }

    setSaving(true);
    setError("");
    try {
      await createActivity(value);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that activity");
    } finally {
      setSaving(false);
    }
  }

  const activeTemplate = TEMPLATES.find((t) => t.type === value.automation_type);
  const title =
    step === "template"
      ? "New activity"
      : kind === "recruitment"
      ? RECRUITMENT_TEMPLATE.title
      : activeTemplate?.title ?? "New activity";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90"
      >
        + Add activity
      </button>

      <Modal open={open} onClose={close} title={title}>
        {step === "template" ? (
          <div>
            <p className="mb-4 text-sm text-ink-soft">Start from a template.</p>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => chooseTemplate(t.type)}
                  className="flex flex-col items-start gap-2 rounded border border-line bg-paper p-4 text-left transition-colors hover:border-moss hover:bg-moss-soft/30"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {t.icon}
                  </span>
                  <span className="font-display text-base italic text-ink">{t.title}</span>
                  <span className="text-xs leading-snug text-ink-soft">{t.description}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={chooseRecruitmentTemplate}
                className="flex flex-col items-start gap-2 rounded border border-line bg-paper p-4 text-left transition-colors hover:border-moss hover:bg-moss-soft/30"
              >
                <span className="text-2xl" aria-hidden="true">
                  {RECRUITMENT_TEMPLATE.icon}
                </span>
                <span className="font-display text-base italic text-ink">
                  {RECRUITMENT_TEMPLATE.title}
                </span>
                <span className="text-xs leading-snug text-ink-soft">
                  {RECRUITMENT_TEMPLATE.description}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <button
              type="button"
              onClick={() => setStep("template")}
              className="text-xs text-ink-soft hover:text-ink"
            >
              &larr; Change template
            </button>

            {kind === "recruitment" ? (
              <RecruitmentFormFields
                value={recruitmentValue}
                onChange={(patch) => setRecruitmentValue((v) => ({ ...v, ...patch }))}
              />
            ) : (
              <ActivityFormFields
                value={value}
                onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
                hideAutomationPicker
              />
            )}

            {error && <p className="text-sm text-rust">{error}</p>}

            <div className="flex justify-end gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={close}
                className="rounded px-4 py-2 text-sm text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || kind === "recruitment"}
                title={kind === "recruitment" ? "Saving lands in the next task" : undefined}
                className="rounded bg-moss px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {kind === "recruitment" ? "Coming soon" : saving ? "Saving\u2026" : "Save activity"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
