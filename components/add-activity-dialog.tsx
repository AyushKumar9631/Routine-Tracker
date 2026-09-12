"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ActivityFormFields } from "@/components/activity-form-fields";
import { createActivity } from "@/actions/activities";
import { defaultActivityForm, automationDefaults } from "@/lib/utils";
import type { ActivityFormInput } from "@/lib/types";

type AutomationType = ActivityFormInput["automation_type"];

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

export function AddActivityDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"template" | "details">("template");
  const [value, setValue] = useState<ActivityFormInput>(defaultActivityForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setOpen(false);
    setStep("template");
    setValue(defaultActivityForm());
    setError("");
  }

  function chooseTemplate(type: AutomationType) {
    setValue((v) => ({ ...v, ...automationDefaults(type) }));
    setStep("details");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90"
      >
        + Add activity
      </button>

      <Modal
        open={open}
        onClose={close}
        title={step === "template" ? "New activity" : activeTemplate?.title ?? "New activity"}
      >
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

            <ActivityFormFields
              value={value}
              onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
              hideAutomationPicker
            />

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
                disabled={saving}
                className="rounded bg-moss px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving\u2026" : "Save activity"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
