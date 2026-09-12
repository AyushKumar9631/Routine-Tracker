"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  getNotificationTopic,
  saveNotificationTopic,
  disconnectNotifications,
  sendTestNotification,
} from "@/actions/notifications";

export function NotificationSettingsButton() {
  const [topic, setTopic] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "sent" | "failed">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    getNotificationTopic()
      .then(setTopic)
      .finally(() => setLoaded(true));
  }, []);

  function openDialog() {
    setInput("");
    setError("");
    setTestResult("idle");
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await saveNotificationTopic(input);
      setTopic(saved);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    setError("");
    try {
      await disconnectNotifications();
      setTopic(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't disconnect");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult("idle");
    try {
      const ok = await sendTestNotification();
      setTestResult(ok ? "sent" : "failed");
    } catch {
      setTestResult("failed");
    } finally {
      setTesting(false);
    }
  }

  const connected = loaded && !!topic;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={cn(
          "flex items-center gap-1.5 border-b border-transparent pb-1 text-sm transition-colors",
          connected ? "text-moss" : "text-ink-soft hover:text-ink"
        )}
      >
        <span
          className={cn("inline-block h-1.5 w-1.5 rounded-full", connected ? "bg-moss" : "bg-line")}
          aria-hidden="true"
        />
        {connected ? "Notifications on" : "Notifications off"}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Push notifications">
        <div className="space-y-5">
          <p className="text-sm text-ink-soft">
            Deadline nudges (like the LeetCode POTD reminder) are sent via{" "}
            <a
              href="https://ntfy.sh"
              target="_blank"
              rel="noreferrer"
              className="text-moss underline"
            >
              ntfy.sh
            </a>{" "}
            — free, no account needed.
          </p>

          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-soft">
            <li>Install the ntfy app (iOS / Android), or just keep a ntfy.sh tab open.</li>
            <li>
              In the app, subscribe to a topic with a random, hard-to-guess name — anyone who
              knows the name can publish to it or read it, so treat it like a secret rather than
              something like &ldquo;my-reminders&rdquo;.
            </li>
            <li>Paste that topic name (or the full ntfy.sh link) below and connect.</li>
          </ol>

          {connected ? (
            <div className="rounded border border-moss/30 bg-moss-soft px-4 py-3">
              <p className="text-sm text-ink">
                Connected to topic <span className="font-mono">{topic}</span>
              </p>

              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="rounded border border-line bg-card px-3 py-1.5 text-sm text-ink transition-colors hover:border-moss disabled:opacity-50"
                >
                  {testing ? "Sending…" : "Send test"}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={saving}
                  className="rounded px-3 py-1.5 text-sm text-rust transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>

              {testResult === "sent" && (
                <p className="mt-2 text-xs text-moss">Sent — check your phone.</p>
              )}
              {testResult === "failed" && (
                <p className="mt-2 text-xs text-rust">
                  Didn&apos;t go through. Double-check the topic name matches what you subscribed to.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="field-label">Topic name or ntfy.sh URL</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="your-name-a1b2c3d4"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  autoFocus
                />
              </div>

              {error && <p className="text-sm text-rust">{error}</p>}

              <div className="flex justify-end gap-3 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded px-4 py-2 text-sm text-ink-soft hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Connecting…" : "Connect"}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </>
  );
}
