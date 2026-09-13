// Shared shape + question definitions for the recruitment research passes
// (plan 1.6.A, H5 rework). Lives here rather than in
// app/api/ai/recruitment-enrich/route.ts because Next.js route handler
// files may only export HTTP method handlers and a small fixed set of
// config values (dynamic, maxDuration, etc.) — any other runtime export
// (like the FIELDS arrays below) fails Next's generated route-export
// validation, even though it built fine in isolation with `tsc`.
//
// The enrich route imports COMPANY_OVERVIEW_QUESTIONS / ROUND_PREP_QUESTIONS
// from here to build its Groq prompts. The chat route and the detail page
// (H4's field list) import CompanyOverviewContent / RoundPrepContent and
// COMPANY_OVERVIEW_FIELDS / ROUND_PREP_FIELDS from here instead of from the
// route file, so the field list — question wording, word limit, and display
// label — only has to be defined once.

// Shapes stored in recruitment_ai_insights.content. Every field is
// independently nullable — "unanswered" (every fallback model failed that
// one question) is a normal, expected outcome per question, not an error
// state for the whole row.
export interface CompanyOverviewContent {
  whatItDoes: string | null;
  scale: string | null;
  recentNews: string | null;
  cultureValues: string | null;
  interviewReputation: string | null;
}

export interface RoundPrepContent {
  topicsWeightage: string | null;
  questionPattern: string | null;
  duration: string | null;
  difficulty: string | null;
  tips: string | null;
}

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

// Field metadata only (no question text) — the H4 detail page and the chat
// route's system prompt import these to render/list "label: value" rows
// generically instead of hardcoding the field list a second time.
export const COMPANY_OVERVIEW_FIELDS = COMPANY_OVERVIEW_QUESTIONS.map(({ key, label }) => ({ key, label }));
export const ROUND_PREP_FIELDS = ROUND_PREP_QUESTIONS.map(({ key, label }) => ({ key, label }));
