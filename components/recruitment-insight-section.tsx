"use client";

import { useEffect, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { retryRecruitmentInsight } from "@/actions/recruitment";
import { AUTO_SYNC_POLL_MS } from "@/lib/sync-config";
import type { InsightStatus } from "@/lib/types";

/**
 * One AI-research section (company overview or round prep) on the
 * recruitment detail page. `status` is `"missing"` when no
 * recruitment_ai_insights row exists yet at all (e.g. right after creation,
 * before the fire-and-forget trigger's insert has landed) — treated the same
 * as `"pending"` here.
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
  const [isRetrying, startTransition] = useTransition();

  useEffect(() => {
    if (status !== "pending" && status !== "missing") return;
    const timer = setInterval(() => router.refresh(), AUTO_SYNC_POLL_MS);
    return () => clearInterval(timer);
  }, [status, router]);

  function handleRetry() {
    startTransition(async () => {
      await retryRecruitmentInsight(activityId, roundId);
      router.refresh();
    });
  }

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm text-ink-soft">{title}</h2>

      {(status === "pending" || status === "missing") && (
        <p className="text-sm text-ink-soft">Researching&hellip;</p>
      )}

      {status === "failed" && (
        <div>
          <p className="text-sm text-rust">{error || "AI research failed."}</p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="mt-2 rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:border-moss hover:text-ink disabled:opacity-50"
          >
            {isRetrying ? "Retrying\u2026" : "Retry"}
          </button>
        </div>
      )}

      {status === "ready" && children}
    </section>
  );
}
