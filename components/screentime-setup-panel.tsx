"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";

export function ScreentimeSetupPanel({
  webhookUrl,
  triggerLabel = "View setup instructions",
  triggerClassName = "text-sm text-ink-soft underline underline-offset-2 hover:text-ink",
}: {
  webhookUrl?: string;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Set up iPhone screen time sync">
        <div className="space-y-4 text-sm text-ink">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Install <strong>Jomo &ndash; Screen Time Blocker</strong> from the App Store
              (free to download).
            </li>
            <li>Open Jomo and grant it Screen Time access when it asks.</li>
            <li>
              In iOS <strong>Settings &rarr; Screen Time</strong>, turn off{" "}
              <strong>Share Across Devices</strong> so the number only reflects this iPhone.
            </li>
            <li>
              In <strong>Settings &rarr; Screen Time &rarr; Estimated Screen Time &rarr; Improve
              Estimate</strong>, select all apps, then open Jomo once to refresh its estimate.
            </li>
            <li>
              Open the <strong>Shortcuts</strong> app and build a new shortcut:
              <div className="mt-2 rounded border border-line bg-paper px-3 py-2 font-mono text-xs text-ink-soft">
                Get Screentime (Jomo) &rarr; Get Contents of URL
              </div>
              <p className="mt-2 text-ink-soft">
                Configure &ldquo;Get Contents of URL&rdquo; as a <strong>POST</strong> with a{" "}
                <strong>JSON</strong> request body, e.g. <code>{"{ \"value\": [Get Screentime] }"}</code>,
                pointed at:
              </p>
            </li>
          </ol>

          <div className="rounded border border-line bg-card px-3 py-2">
            {webhookUrl ? (
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="shrink-0 rounded border border-line px-2 py-1 text-xs text-ink-soft hover:border-moss hover:text-ink"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : (
              <p className="text-xs text-ink-soft">
                This activity&apos;s webhook URL will appear here once you save it &mdash; come
                back to this panel from the activity page to grab it.
              </p>
            )}
          </div>

          <ol start={6} className="list-decimal space-y-3 pl-5">
            <li>
              In Shortcuts &rarr; <strong>Automation</strong>, create a new personal automation
              on a daily time (e.g. 11:55 PM) or an &ldquo;App opens&rdquo; trigger, running this
              shortcut. Turn off &ldquo;Ask Before Running&rdquo; so it fires silently.
            </li>
          </ol>

          <p className="border-t border-line pt-3 text-xs text-ink-soft">
            Jomo&apos;s number is its own on-device estimate, not raw Apple data, so it can be a
            few minutes off &mdash; that&apos;s expected. There&apos;s also no per-app or
            per-site breakdown this way, only a single daily total.
          </p>

          <div className="flex justify-end border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded bg-ink px-4 py-2 text-sm text-paper transition-opacity hover:opacity-90"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
