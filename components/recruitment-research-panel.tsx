"use client";

import { useEffect, useRef, useState } from "react";
import { ensureRecruitmentInsight } from "@/actions/recruitment";
import {
  COMPANY_OVERVIEW_FIELDS,
  ROUND_PREP_FIELDS,
  countAnswered,
  type QuestionRecord,
} from "@/lib/ai/recruitment-research";

/**
 * Drives the H7 sequential research stepper from the browser and renders
 * live progress for both passes (company overview, then round prep).
 *
 * Replaces the old RecruitmentInsightSection (H4/H5), which just displayed
 * server-computed status and re-fetched the page on an interval. That
 * worked when a server route did all the work in one shot; H7 moved the
 * actual Groq calling to a client-driven step endpoint
 * (app/api/ai/recruitment-enrich/step) that does exactly one bounded
 * attempt per call, so *something* has to be the one calling it repeatedly
 * and showing progress in between — that's this component's job.
 *
 * Sequencing: on mount, company overview's stepper runs to completion (or
 * a halt) first; round prep's only starts afterward, and only if company
 * overview didn't halt on exhaustion (hammering round prep against the
 * same exhausted models right after is unlikely to help). A manual
 * "Start/Resume/Continue research" click on either section only drives
 * that one section, no cascading — clicking Round prep's button doesn't
 * also re-run Company overview.
 */

type Kind = "company_overview" | "round_prep";

interface StepResponse {
  done: boolean;
  allDone?: boolean;
  haltReason?: "exhausted";
  waiting?: boolean;
  currentQuestion?: string;
  model?: string;
  answered: number;
  total: number;
  elapsedMs?: number;
  content: Record<string, QuestionRecord>;
  error?: string;
}

export interface SectionSnapshot {
  insightId: string | null;
  content: Record<string, QuestionRecord> | null;
  status: "pending" | "ready" | "failed";
  haltReason: "exhausted" | null;
}

interface SectionRuntimeState {
  content: Record<string, QuestionRecord> | null;
  ready: boolean;
  haltReason: "exhausted" | null;
  answered: number;
  running: boolean;
  currentQuestionKey: string | null;
  currentModel: string | null;
  waitingElapsedMs: number | null;
  clientError: string | null;
}

const FIELDS_BY_KIND: Record<Kind, { key: string; label: string }[]> = {
  company_overview: COMPANY_OVERVIEW_FIELDS,
  round_prep: ROUND_PREP_FIELDS,
};

const TITLE_BY_KIND: Record<Kind, string> = {
  company_overview: "Company overview",
  round_prep: "Round prep",
};

// A single question is allowed up to this long of accumulated patience
// server-side (lib/ai/recruitment-research.ts's QUESTION_TIMEOUT_MS) —
// mirrored here only for display text, not for any actual timing logic.
const QUESTION_TIMEOUT_LABEL = "10 min";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initFromSnapshot(snapshot: SectionSnapshot | null): SectionRuntimeState {
  return {
    content: snapshot?.content ?? null,
    ready: snapshot?.status === "ready",
    haltReason: snapshot?.haltReason ?? null,
    answered: snapshot?.content ? countAnswered(snapshot.content) : 0,
    running: false,
    currentQuestionKey: null,
    currentModel: null,
    waitingElapsedMs: null,
    clientError: null,
  };
}

function snapshotNeedsWork(snapshot: SectionSnapshot | null): boolean {
  if (!snapshot) return true;
  if (snapshot.status === "ready") return false;
  if (snapshot.haltReason === "exhausted") return false; // needs a manual resume, not an auto-start
  return true;
}

function sectionPhase(s: SectionRuntimeState): "missing" | "running" | "halted" | "paused" | "ready" {
  if (s.running) return "running";
  if (s.ready) return "ready";
  if (s.haltReason === "exhausted") return "halted";
  if (s.content === null) return "missing";
  return "paused";
}

export function RecruitmentResearchPanel({
  activityId,
  roundId,
  companyOverview,
  roundPrep,
}: {
  activityId: string;
  roundId?: string;
  companyOverview: SectionSnapshot;
  roundPrep: SectionSnapshot | null;
}) {
  const [overview, setOverview] = useState<SectionRuntimeState>(() => initFromSnapshot(companyOverview));
  const [prep, setPrep] = useState<SectionRuntimeState>(() => initFromSnapshot(roundPrep));
  const startedAutoRun = useRef(false);

  function setSection(kind: Kind, updater: (s: SectionRuntimeState) => SectionRuntimeState) {
    (kind === "company_overview" ? setOverview : setPrep)(updater);
  }

  async function runStepperLoop(kind: Kind): Promise<{ haltReason: "exhausted" | null }> {
    setSection(kind, (s) => ({ ...s, running: true, clientError: null }));

    let haltReason: "exhausted" | null = null;

    try {
      const { insightId } = await ensureRecruitmentInsight(activityId, kind, roundId);
      setSection(kind, (s) => ({ ...s, haltReason: null, clientError: null }));

      for (;;) {
        const res: StepResponse = await fetch("/api/ai/recruitment-enrich/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ insightId }),
        }).then((r) => r.json());

        if (res.error) {
          setSection(kind, (s) => ({ ...s, clientError: res.error ?? "Something went wrong" }));
          break;
        }

        haltReason = res.haltReason ?? null;
        const ready = Boolean(res.allDone);

        setSection(kind, (s) => ({
          ...s,
          content: res.content ?? s.content,
          answered: res.answered,
          currentQuestionKey: res.waiting || !res.done ? res.currentQuestion ?? null : null,
          currentModel: res.model ?? null,
          waitingElapsedMs: res.waiting ? res.elapsedMs ?? null : null,
          haltReason,
          ready,
        }));

        if (res.done) break;
        // Everything except "ambiguous failure, still within the window"
        // already got a fast, definitive response (a fresh answer, a
        // rate-limit model advance, a 10-minute skip) and can loop right
        // away. Only the "waiting" case pauses briefly before retrying.
        if (res.waiting) await sleep(1500);
      }
    } catch (err) {
      setSection(kind, (s) => ({
        ...s,
        clientError: err instanceof Error ? err.message : "Something went wrong",
      }));
    } finally {
      setSection(kind, (s) => ({
        ...s,
        running: false,
        currentQuestionKey: null,
        currentModel: null,
        waitingElapsedMs: null,
      }));
    }

    return { haltReason };
  }

  useEffect(() => {
    if (startedAutoRun.current) return;
    startedAutoRun.current = true;

    (async () => {
      let overviewHalted = companyOverview.haltReason === "exhausted";
      if (snapshotNeedsWork(companyOverview)) {
        const result = await runStepperLoop("company_overview");
        overviewHalted = result.haltReason === "exhausted";
      }
      if (overviewHalted) return; // don't cascade into round prep right after an exhaustion halt
      if (roundId && roundPrep && snapshotNeedsWork(roundPrep)) {
        await runStepperLoop("round_prep");
      }
    })();
    // Deliberately once-on-mount — re-running this on every prop change
    // would restart the whole sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <SectionView
        kind="company_overview"
        state={overview}
        onStart={() => void runStepperLoop("company_overview")}
      />
      {roundId && (
        <SectionView kind="round_prep" state={prep} onStart={() => void runStepperLoop("round_prep")} />
      )}
    </>
  );
}

function SectionView({ kind, state, onStart }: { kind: Kind; state: SectionRuntimeState; onStart: () => void }) {
  const fields = FIELDS_BY_KIND[kind];
  const total = fields.length;
  const phase = sectionPhase(state);
  const remaining = total - state.answered;
  const currentLabel = state.currentQuestionKey
    ? fields.find((f) => f.key === state.currentQuestionKey)?.label
    : undefined;

  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm text-ink-soft">{TITLE_BY_KIND[kind]}</h2>

      {state.clientError && <p className="mb-2 text-sm text-rust">{state.clientError}</p>}

      {phase === "missing" && (
        <div>
          <p className="text-sm text-ink-soft">Not researched yet.</p>
          <button
            type="button"
            onClick={onStart}
            className="mt-2 rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:border-moss hover:text-ink"
          >
            Start research
          </button>
        </div>
      )}

      {phase === "running" && (
        <div className="text-sm text-ink-soft">
          <p>
            Researching &mdash; {state.answered} of {total} answered.
          </p>
          {currentLabel && (
            <p className="mt-1 text-xs">
              Trying {state.currentModel ?? "the next model"} for &ldquo;{currentLabel}&rdquo;
              {state.waitingElapsedMs != null &&
                ` (retrying \u2014 ${Math.round(state.waitingElapsedMs / 1000)}s of up to ${QUESTION_TIMEOUT_LABEL})`}
              &hellip;
            </p>
          )}
          {remaining > 0 && (
            <p className="mt-1 text-xs">Up to ~{remaining * 10} min remaining (worst case &mdash; usually much faster).</p>
          )}
        </div>
      )}

      {phase === "halted" && (
        <div>
          <p className="text-sm text-rust">
            Paused &mdash; every available model is rate-limited right now. {state.answered} of {total} answered so far.
          </p>
          <button
            type="button"
            onClick={onStart}
            className="mt-2 rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:border-moss hover:text-ink"
          >
            Resume research
          </button>
        </div>
      )}

      {phase === "paused" && (
        <div>
          <p className="text-sm text-ink-soft">
            {state.answered} of {total} answered so far.
          </p>
          <button
            type="button"
            onClick={onStart}
            className="mt-2 rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:border-moss hover:text-ink"
          >
            Continue research
          </button>
        </div>
      )}

      {phase === "ready" && state.content && <InsightFieldList fields={fields} content={state.content} />}
    </section>
  );
}

/**
 * Renders a research pass's content as "label: answer" rows. A question in
 * state "unknown" (the model was asked and said it genuinely doesn't know)
 * renders as a muted "Not found" — distinct from "skipped"/"unattempted",
 * which shouldn't normally still be showing once phase is "ready" (that
 * only happens once every field is resolved or unknown).
 */
function InsightFieldList({
  fields,
  content,
}: {
  fields: { key: string; label: string }[];
  content: Record<string, QuestionRecord>;
}) {
  return (
    <dl className="space-y-2 text-sm">
      {fields.map(({ key, label }) => {
        const record = content[key];
        const answer = record?.state === "resolved" ? record.answer : null;
        return (
          <div key={key}>
            <dt className="text-ink-soft">{label}</dt>
            <dd className={answer ? "text-ink" : "italic text-ink-soft/70"}>{answer ?? "Not found"}</dd>
          </div>
        );
      })}
    </dl>
  );
}
