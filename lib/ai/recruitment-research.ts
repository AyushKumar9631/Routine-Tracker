// Shared shape + question definitions for the recruitment research passes
// (plan 1.6.A, reworked in H5 into small per-question calls and again in H7
// into a sequential, resumable, client-driven stepper). Lives here rather
// than in a route.ts file because Next.js route handlers may only export
// HTTP method handlers and a small fixed set of config values — any other
// runtime export fails Next's generated route-export validation (H5 learned
// this the hard way; `tsc --noEmit` alone doesn't catch it).
//
// Both app/api/ai/recruitment-enrich/step/route.ts (the stepper) and
// actions/recruitment.ts (ensureRecruitmentInsight) import the question
// lists and helpers below. The chat route and the detail page's field list
// import the *Content types and FIELDS metadata.

// --- Per-question state -----------------------------------------------
//
// H7: each question now tracks a real state, not just a nullable string,
// because "never attempted", "the model said it doesn't know", and "we gave
// up on this one for now" all need to be told apart:
//   - "unattempted": eligible for the stepper to pick up next.
//   - "resolved": has a real answer. Terminal — a fresh Start research/Retry
//     does NOT re-ask it ("checks which questions has already been
//     answered and doesn't produce answers of those questions again").
//   - "unknown": the model was asked and explicitly said it doesn't know
//     (the "UNKNOWN" sentinel below). Also terminal, for the same reason —
//     a real negative is still an answer, not an omission.
//   - "skipped": the stepper gave up on it after QUESTION_TIMEOUT_MS of
//     ambiguous failures (see step/route.ts) *during one run*. NOT
//     terminal — resetSkippedToUnattempted() below puts these back to
//     "unattempted" so the next Start research/Retry (or page reload) tries
//     them again. Kept distinct from "unattempted" so the stepper doesn't
//     immediately re-select the same stuck question and loop forever within
//     a single run — it moves on to the next unattempted one instead.
export type QuestionState = "unattempted" | "resolved" | "unknown" | "skipped";

export interface QuestionRecord {
  answer: string | null; // populated only when state === "resolved"
  state: QuestionState;
}

// Shapes stored in recruitment_ai_insights.content.
export type CompanyOverviewContent = Record<
  | "whatItDoes"
  | "scale"
  | "recentNews"
  | "cultureValues"
  | "interviewReputation",
  QuestionRecord
>;

export type RoundPrepContent = Record<
  "topicsWeightage" | "questionPattern" | "duration" | "difficulty" | "tips",
  QuestionRecord
>;

// --- Per-row stepping progress ------------------------------------------
//
// Stored in recruitment_ai_insights.progress (migration 016). NULL means
// "no run in progress right now" — either nothing has started, or the last
// question resolved and the stepper is about to move to a fresh one.
export interface RowProgress {
  /** Which question (by key) the fallback chain below is currently working
   * through. If this doesn't match the stepper's freshly-computed "next
   * attemptable question" on a given call, that call treats it as a fresh
   * start on a NEW question — resetting currentModelIndex and the clock —
   * rather than trusting possibly-stale state. Self-healing by design. */
  currentQuestionKey: string | null;
  /** Index into GROQ_RESEARCH_MODELS for the current question's fallback
   * attempt. Advances on a clean rate/token-limit rejection; does NOT reset
   * on an ambiguous failure (that retries the same model). */
  currentModelIndex: number;
  /** ISO timestamp of when the stepper started on the CURRENT question —
   * the 10-minute-per-question ceiling is measured against this across
   * however many short step() calls it takes, not within a single call. */
  questionStartedAt: string | null;
  /** Set once every model in GROQ_RESEARCH_MODELS has been tried for the
   * current question and every single one came back with a clean
   * rate/token-limit rejection — a strong signal that capacity is gone
   * everywhere, not just for this one topic. Halts the WHOLE row's
   * stepping (not just this question) until a manual Start research/Retry
   * clears it, on the theory that hammering the remaining questions
   * against the same exhausted models is unlikely to do anything but waste
   * the little quota that might trickle back. */
  haltReason: "exhausted" | null;
}

/** A single 10-minute ceiling of ambiguous-failure patience per question,
 * accumulated across many short step() calls (see step/route.ts's top
 * comment for why this can't just be one long-blocking request). */
export const QUESTION_TIMEOUT_MS = 10 * 60 * 1000;

/** How long a single Groq call gets before step() treats it as an
 * ambiguous failure and moves on (retry-same-model-next-poll, or advance
 * to the next model if it was a clean rate limit). Comfortably inside any
 * Vercel plan's default maxDuration for the step route. */
export const STEP_ATTEMPT_TIMEOUT_MS = 25_000;

// --- Question definitions ------------------------------------------------

export interface DriveDetailsForResearch {
  company_name: string;
  company_url: string | null;
  role: string;
}

export interface ResearchQuestion<K extends string> {
  key: K;
  label: string;
  maxWords: number;
  /** `roundLabel` is only meaningful for round-prep questions; company
   * overview questions ignore it. */
  question: (details: DriveDetailsForResearch, roundLabel: string) => string;
}

export const COMPANY_OVERVIEW_QUESTIONS: ResearchQuestion<keyof CompanyOverviewContent>[] = [
  {
    key: "whatItDoes",
    label: "What they do",
    maxWords: 35,
    question: (d) => `What does ${d.company_name} do? Summarize its core business, products, or services.`,
  },
  {
    key: "scale",
    label: "Scale",
    maxWords: 30,
    question: (d) =>
      `What is ${d.company_name}'s scale -- company size, employee count, and revenue or funding stage?`,
  },
  {
    key: "recentNews",
    label: "Recent news",
    maxWords: 30,
    question: (d) =>
      `What is one notable recent development or news story about ${d.company_name} from roughly the last 12 months?`,
  },
  {
    key: "cultureValues",
    label: "Culture & values",
    maxWords: 30,
    question: (d) => `What is ${d.company_name}'s workplace culture or stated values like?`,
  },
  {
    key: "interviewReputation",
    label: "Interview reputation",
    maxWords: 35,
    question: (d) =>
      `Based on public candidate experiences, what is ${d.company_name}'s interview process generally like?`,
  },
];

export const ROUND_PREP_QUESTIONS: ResearchQuestion<keyof RoundPrepContent>[] = [
  {
    key: "topicsWeightage",
    label: "Topics & weightage",
    maxWords: 35,
    question: (d, r) =>
      `For the ${r} round at ${d.company_name} for a ${d.role} position, what topics are typically tested and what is their relative weightage or emphasis?`,
  },
  {
    key: "questionPattern",
    label: "Questions & pattern",
    maxWords: 30,
    question: (d, r) =>
      `For the ${r} round at ${d.company_name} for a ${d.role} position, how many questions are typically asked and what is the pattern or format (e.g. MCQ, coding, subjective)?`,
  },
  {
    key: "duration",
    label: "Duration",
    maxWords: 15,
    question: (d, r) => `What is the typical duration of the ${r} round at ${d.company_name}?`,
  },
  {
    key: "difficulty",
    label: "Difficulty",
    maxWords: 15,
    question: (d, r) =>
      `What is the typical difficulty level of the ${r} round at ${d.company_name} for a ${d.role} position?`,
  },
  {
    key: "tips",
    label: "Prep tip",
    maxWords: 35,
    question: (d, r) => `What is one specific, actionable preparation tip for the ${r} round at ${d.company_name}?`,
  },
];

// Field metadata only (no question text) — the detail page and the chat
// route's system prompt import these to render/list rows generically
// instead of hardcoding the field list a second time.
export const COMPANY_OVERVIEW_FIELDS = COMPANY_OVERVIEW_QUESTIONS.map(({ key, label }) => ({ key, label }));
export const ROUND_PREP_FIELDS = ROUND_PREP_QUESTIONS.map(({ key, label }) => ({ key, label }));

// --- Content helpers -------------------------------------------------------

/** Fresh "nothing attempted yet" content for a question list — the starting
 * state for a brand new insight row. */
export function initialContent<K extends string>(questions: { key: K }[]): Record<K, QuestionRecord> {
  return Object.fromEntries(questions.map((q) => [q.key, { answer: null, state: "unattempted" as const }])) as Record<
    K,
    QuestionRecord
  >;
}

/** Self-healing merge: fills in any question missing from a stored content
 * object (an older-shape row from before H7, or a row saved mid-migration)
 * as "unattempted" instead of leaving it undefined. */
export function withMissingQuestionsFilled<K extends string>(
  questions: { key: K }[],
  content: Partial<Record<K, QuestionRecord>> | null | undefined
): Record<K, QuestionRecord> {
  const result = { ...(content ?? {}) } as Record<K, QuestionRecord>;
  for (const q of questions) {
    if (!result[q.key]) result[q.key] = { answer: null, state: "unattempted" };
  }
  return result;
}

/** Count of questions in a terminal, "answered" state — resolved or a
 * confirmed "unknown". Used for both the "X of Y" progress display and to
 * decide when a row is fully done (answeredCount === questions.length). */
export function countAnswered(content: Record<string, QuestionRecord>): number {
  return Object.values(content).filter((q) => q.state === "resolved" || q.state === "unknown").length;
}

/** Index of the next question the stepper should attempt — the first one
 * still "unattempted". Deliberately skips "skipped" ones (see QuestionState
 * doc above): those get retried by a fresh run, not automatically within
 * the run that gave up on them. Returns -1 if nothing is attemptable right
 * now (everything is resolved/unknown/skipped). */
export function findNextAttemptableIndex<K extends string>(
  questions: { key: K }[],
  content: Record<K, QuestionRecord>
): number {
  return questions.findIndex((q) => (content[q.key]?.state ?? "unattempted") === "unattempted");
}

/** Resets any "skipped" questions back to "unattempted" — what a fresh
 * Start research/Retry does before a new stepping run begins, so questions
 * abandoned to an earlier run's 10-minute ceiling get a clean second try
 * without re-asking anything that was genuinely resolved or confirmed
 * unknown. */
export function resetSkippedToUnattempted<K extends string>(
  content: Record<K, QuestionRecord>
): Record<K, QuestionRecord> {
  const result = { ...content };
  for (const key of Object.keys(result) as K[]) {
    if (result[key]?.state === "skipped") result[key] = { answer: null, state: "unattempted" };
  }
  return result;
}

/** Model output that means "no answer" -- stored as state "unknown", not as
 * text, and never re-asked once it resolves that way. */
export function isUnknownAnswer(text: string): boolean {
  return /^unknown\.?$/i.test(text.trim());
}

/**
 * H8: Groq's browser_search tool sometimes appends citation markers like
 * "【2†L55-L62】" directly onto the model's answer text (immediately after a
 * word, no space) — meaningless inline noise here, since there's no way for
 * this UI to resolve them to an actual source. Stripped as defense-in-depth
 * before word-counting/truncation runs, same "prompt asks nicely, code
 * guarantees it" philosophy as the word cap below — researchSystemPrompt
 * also tells the model not to include these, but that's a request, not a
 * guarantee, exactly like the word limit itself.
 */
function stripCitationArtifacts(text: string): string {
  return text
    .replace(/\u3010[^\u3011]*\u3011/g, "") // the 【...】 bracket pair specifically
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Belt-and-suspenders word cap -- the prompt already asks for this, this
 * guarantees it regardless of whether a given model actually complied.
 * Only reflows onto one line (losing bullet formatting) when truncation
 * actually has to kick in -- the common case, where the model stayed under
 * the limit, returns the text untouched (newlines and all), which is what
 * lets a multi-line bullet answer render as an actual list on the detail
 * page instead of getting flattened into one run-on line. */
export function truncateWords(text: string, maxWords: number): string {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) return trimmed;
  return words.slice(0, maxWords).join(" ") + "\u2026";
}

/** Turns a raw model reply into the answer half of a QuestionRecord — null
 * (meaning "state: unknown") if the model said so or replied with nothing
 * usable, otherwise the cleaned, word-capped text. */
export function normalizeAnswer(raw: string, maxWords: number): string | null {
  const cleaned = stripCitationArtifacts(raw);
  if (!cleaned || isUnknownAnswer(cleaned)) return null;
  return truncateWords(cleaned, maxWords);
}

export function researchSystemPrompt(maxWords: number): string {
  return (
    "You are a research assistant helping a job candidate prep for an interview. " +
    "Answer ONLY the question in the next message. Keep the answer clean and simple: " +
    'plain prose by default. If the answer is naturally a short list of distinct ' +
    'items (e.g. several topics, or a few tips), you may instead write one short ' +
    'point per line, each line starting with "- ", instead of prose -- but use no ' +
    "other formatting (no headers, no bold, no numbered lists). Either way, never " +
    'include citation markers, footnotes, or bracketed source references of any ' +
    'kind (for example "\u30101\u2020L12-L14\u3011") in the answer text itself -- write ' +
    "the answer as if there were no sources to cite, even though you did look them " +
    `up. Maximum ${maxWords} words total. If you don't have reliable information to ` +
    'answer, respond with exactly the single word "UNKNOWN" and nothing else -- ' +
    "never invent specifics."
  );
}
