"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ActivityFormFields } from "@/components/activity-form-fields";
import { createActivity } from "@/actions/activities";
import { defaultActivityForm } from "@/lib/utils";
import type { ActivityFormInput } from "@/lib/types";

export function AddActivityDialog() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<ActivityFormInput>(defaultActivityForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setOpen(false);
    setValue(defaultActivityForm());
    setError("");
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90"
      >
        + Add activity
      </button>

      <Modal open={open} onClose={close} title="New activity">
        <form onSubmit={handleSubmit} className="space-y-5">
          <ActivityFormFields
            value={value}
            onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
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
      </Modal>
    </>
  );
}
