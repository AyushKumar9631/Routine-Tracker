"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ActivityFormFields } from "@/components/activity-form-fields";
import { updateActivity, deleteActivity } from "@/actions/activities";
import { getLeetcodeUsername } from "@/actions/leetcode";
import type { Activity, ActivityFormInput } from "@/lib/types";

function toFormInput(activity: Activity, leetcodeUsername = ""): ActivityFormInput {
  return {
    name: activity.name,
    description: activity.description ?? "",
    icon: activity.icon ?? "\u2713",
    color: activity.color ?? "#3F6B47",
    period: activity.period,
    schedule_day_of_week: activity.schedule_day_of_week,
    schedule_day_of_month: activity.schedule_day_of_month,
    anchor_date: activity.anchor_date,
    completion_type: activity.completion_type,
    target_value: activity.target_value,
    unit_label: activity.unit_label ?? "",
    automation_type: activity.automation_type === "leetcode_potd" ? "leetcode_potd" : "none",
    leetcode_username: leetcodeUsername,
  };
}

export function EditActivityDialog({ activity }: { activity: Activity }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<ActivityFormInput>(() => toFormInput(activity));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  function openDialog() {
    setOpen(true);
    if (activity.automation_type === "leetcode_potd") {
      getLeetcodeUsername(activity.id).then((username) =>
        setValue(toFormInput(activity, username))
      );
    } else {
      setValue(toFormInput(activity));
    }
  }

  function close() {
    setOpen(false);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateActivity(activity.id, value);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${activity.name}"? This also removes its logged history.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteActivity(activity.id);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this activity");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="text-sm text-ink-soft hover:text-ink transition-colors"
      >
        Edit
      </button>

      <Modal open={open} onClose={close} title="Edit activity">
        <form onSubmit={handleSubmit} className="space-y-5">
          <ActivityFormFields
            value={value}
            onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
          />

          {error && <p className="text-sm text-rust">{error}</p>}

          <div className="flex items-center justify-between border-t border-line pt-4">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-rust hover:opacity-80 disabled:opacity-50"
            >
              {deleting ? "Deleting\u2026" : "Delete activity"}
            </button>

            <div className="flex gap-3">
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
                {saving ? "Saving\u2026" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
