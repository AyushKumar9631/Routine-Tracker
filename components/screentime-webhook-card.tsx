"use client";

import { useEffect, useState, useTransition } from "react";
import { regenerateScreentimeToken } from "@/actions/screentime";
import { ScreentimeSetupPanel } from "@/components/screentime-setup-panel";
import { formatRelativeTime } from "@/lib/utils";

export function ScreentimeWebhookCard({
  activityId,
  token,
  lastSyncedAt,
}: {
  activityId: string;
  token: string;
  lastSyncedAt: string | null;
}) {
  const [origin, setOrigin] = useState("");
  const [currentToken, setCurrentToken] = useState(token);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const webhookUrl = origin ? `${origin}/api/screentime/${currentToken}` : "";

  function copyUrl() {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function rotate() {
    if (
      !window.confirm(
        "Rotating the token breaks your existing Shortcut until you rebuild it with the new URL. Continue?"
      )
    ) {
      return;
    }
    startTransition(async () => {
      const next = await regenerateScreentimeToken(activityId);
      setCurrentToken(next);
    });
  }

  return (
    <div className="rounded border border-line bg-card px-4 py-3 text-sm">
      <p className="text-ink-soft">Auto-tracked via Screen Time (iPhone)</p>
      <p className="mt-1 text-xs text-ink-soft">Last synced {formatRelativeTime(lastSyncedAt)}</p>

      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded border border-line bg-paper px-2 py-1 font-mono text-xs text-ink">
          {webhookUrl || "\u2026"}
        </code>
        <button
          type="button"
          onClick={copyUrl}
          disabled={!webhookUrl}
          className="shrink-0 rounded border border-line px-2 py-1 text-xs text-ink-soft hover:border-moss hover:text-ink disabled:opacity-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <ScreentimeSetupPanel
          webhookUrl={webhookUrl}
          triggerLabel="View setup instructions"
          triggerClassName="text-xs text-ink-soft underline underline-offset-2 hover:text-ink"
        />
        <button
          type="button"
          onClick={rotate}
          disabled={isPending}
          className="text-xs text-rust underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
        >
          {isPending ? "Rotating\u2026" : "Rotate webhook URL"}
        </button>
      </div>
    </div>
  );
}
