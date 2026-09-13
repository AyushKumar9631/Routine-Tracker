"use client";

import { useEffect, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { retryRecruitmentInsight } from "@/actions/recruitment";
import { AUTO_SYNC_POLL_MS } from "@/lib/sync-config";
import type { InsightStatus } from "@/lib/types";

/**
 * One AI-research section (company overview or round prep) on the
 * recruitment detail page. `status` is `"missing"` when no
 * recruitment_ai_insights row exists yet at all (e.g. the fire-and-forget
 * trigger from creation never landed) — distinct from `"pending"` (a row
 * exists and Groq is actively being called).
 *
 * `"missing"` gets its own "Start research" action (H4): it used to be
 * silently lumped in with `"pending"` and just showed "Researching…"
 * forever with no way for the user to do anything about it if the
 * auto-trigger never actually fired — exactly the gap F4's own notes
 * flagged and didn't fix at the time. Reuses the same
 * `retryRecruitmentInsight` server action the failed-state "Retry" button
 * already calls — `ensurePendingInsight` on the enrich route inserts a
 * fresh row when none exists, so no server-side change was needed here,
 * only the UI affordance.
 *
 * While pending/missing, polls the page via router.refresh() at the same
 * interval the LeetCode/GFG "Check now" buttons already auto-poll at
 * (lib/sync-config.ts) so the section fills in on its own once the AI pass
 * finishes, without the user needing to know to reload.
 */
export function RecruitmentInsightSection({
  title,
  activityId,
  roundId,
  status,
  error,
  children,
}: {
  title: string;
  activityId: string;
  roundId?: string;
  status: InsightStatus | "missing";
  error?: string | null;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [isTriggering, startTransition] = useTransition();

  useEffect(() => {
    if (status !== "pending" && status !== "missing") return;
    const timer = setInterval(() => router.refresh(), AUTO_SYNC_POLL_MS);
    return () => clearInterval(timer);
  }, [status, router]);

  function handleTrigger() {
    startTransition(async () => {
      await retryRecruitmentInsight(activityId, roundId);
      router.refresh();
    });
  }

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm text-ink-soft">{title}</h2>

      {status === "pending" && <p className="text-sm text-ink-soft">Researching&hellip;</p>}

      {status === "missing" && (
        <div>
          <p className="text-sm text-ink-soft">Not researched yet.</p>
          <button
            type="button"
            onClick={handleTrigger}
            disabled={isTriggering}
            className="mt-2 rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:border-moss hover:text-ink disabled:opacity-50"
          >
            {isTriggering ? "Starting\u2026" : "Start research"}
          </button>
        </div>
      )}

      {status === "failed" && (
        <div>
          <p className="text-sm text-rust">{error || "AI research failed."}</p>
          <button
            type="button"
            onClick={handleTrigger}
            disabled={isTriggering}
            className="mt-2 rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:border-moss hover:text-ink disabled:opacity-50"
          >
            {isTriggering ? "Retrying\u2026" : "Retry"}
          </button>
        </div>
      )}

      {status === "ready" && children}
    </section>
  );
}
