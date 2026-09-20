"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { StopwatchIcon } from "@/components/stopwatch-icon";
import { startQuickStopwatch } from "@/actions/quick-stopwatch";

export function QuickStopwatchButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setOpen(false);
    setLabel("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await startQuickStopwatch(label);
      close();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the stopwatch");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Start a quick stopwatch"
        title="Quick stopwatch"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line bg-card text-ink-soft transition-colors hover:border-moss hover:text-ink"
      >
        <StopwatchIcon className="h-4 w-4" />
      </button>

      <Modal open={open} onClose={close} title="Quick stopwatch">
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-ink-soft">
            For studying something off your routine &mdash; give it a label and it starts counting
            up right away. Pause, resume, or complete it whenever you're done.
          </p>
          <div>
            <label className="field-label">Label</label>
            <input
              type="text"
              autoFocus
              required
              className="field-input"
              placeholder="e.g. Revising OS notes"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
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
              {saving ? "Starting\u2026" : "Start"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
