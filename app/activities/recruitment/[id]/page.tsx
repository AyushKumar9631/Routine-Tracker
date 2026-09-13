import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { ActivityIcon } from "@/components/activity-icon";
import { RecruitmentRow } from "@/components/recruitment-row";
import { RecruitmentInsightSection } from "@/components/recruitment-insight-section";
import { RecruitmentChat } from "@/components/recruitment-chat";
import { currentRound, RESULT_LABELS, ROUND_TYPE_LABELS, sortRounds } from "@/lib/recruitment";
import type {
  Activity,
  RecruitmentAiInsight,
  RecruitmentChatMessage,
  RecruitmentDetails,
  RecruitmentRound,
} from "@/lib/types";
import {
  COMPANY_OVERVIEW_FIELDS,
  ROUND_PREP_FIELDS,
  type CompanyOverviewContent,
  type RoundPrepContent,
} from "@/lib/ai/recruitment-research";
import { cn } from "@/lib/utils";

/**
 * H5: renders a research pass's content as "label: answer" rows, driven by
 * the field metadata the enrich route exports (COMPANY_OVERVIEW_FIELDS /
 * ROUND_PREP_FIELDS) so the field list only has to be defined once, there.
 * A null answer (every fallback model failed that one question — an
 * expected, non-error outcome) renders as a muted "Not found" rather than
 * being hidden, so it's visible that this question was attempted.
 */
function InsightFieldList<K extends string>({
  fields,
  content,
}: {
  fields: { key: K; label: string }[];
  content: Record<K, string | null>;
}) {
  return (
    <dl className="space-y-2 text-sm">
      {fields.map(({ key, label }) => (
        <div key={key}>
          <dt className="text-ink-soft">{label}</dt>
          <dd className={content[key] ? "text-ink" : "italic text-ink-soft/70"}>
            {content[key] ?? "Not found"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Read-only line for any round that isn't the current one (see 1.4 — every
 * earlier round is, by construction, already resolved to get here). */
function RoundHistoryItem({ round }: { round: RecruitmentRound }) {
  const resultColor =
    round.result === "passed" ? "text-moss" : round.result === "rejected" ? "text-rust" : "text-ink-soft";

  return (
    <li className="border-b border-line py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink">
          Round {round.round_no} &middot; {ROUND_TYPE_LABELS[round.round_type]}
        </p>
        <span className={cn("text-xs", resultColor)}>{RESULT_LABELS[round.result]}</span>
      </div>
      <p className="mt-0.5 text-xs text-ink-soft">
        {round.test_date
          ? new Date(round.test_date).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "No date was set"}
      </p>
    </li>
  );
}

export default async function RecruitmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: activityData } = await supabase.from("activities").select("*").eq("id", id).single();
  const activity = activityData as Activity | null;
  if (!activity || activity.kind !== "recruitment") notFound();

  const { data: detailsData } = await supabase
    .from("recruitment_details")
    .select("*")
    .eq("activity_id", id)
    .maybeSingle();
  const details = detailsData as RecruitmentDetails | null;
  if (!details) notFound();

  const { data: roundsData } = await supabase
    .from("recruitment_rounds")
    .select("*")
    .eq("activity_id", id);
  const rounds = sortRounds((roundsData ?? []) as RecruitmentRound[]);
  const current = currentRound(rounds);
  const olderRounds = current ? rounds.filter((r) => r.id !== current.id) : rounds;

  const { data: insightsData } = await supabase
    .from("recruitment_ai_insights")
    .select("*")
    .eq("activity_id", id);
  const insights = (insightsData ?? []) as RecruitmentAiInsight[];
  const companyOverview = insights.find((i) => i.kind === "company_overview" && i.round_id === null);
  const roundPrep = current
    ? insights.find((i) => i.kind === "round_prep" && i.round_id === current.id)
    : undefined;
  const overviewContent = companyOverview?.content as CompanyOverviewContent | undefined;
  const roundPrepContent = roundPrep?.content as RoundPrepContent | undefined;

  const { data: chatMessagesData } = await supabase
    .from("recruitment_chat_messages")
    .select("*")
    .eq("activity_id", id)
    .order("created_at", { ascending: true });
  const chatMessages = (chatMessagesData ?? []) as RecruitmentChatMessage[];

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/activities" className="text-sm text-ink-soft hover:text-ink">
          &larr; Activities
        </Link>

        <div className="mb-8 mt-3">
          <h1 className="font-display text-3xl italic text-ink">
            <ActivityIcon icon={activity.icon} className="mr-2" />
            {details.company_url ? (
              <a
                href={details.company_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-2"
              >
                {details.company_name}
              </a>
            ) : (
              details.company_name
            )}
            <span className="text-ink-soft"> &mdash; {details.role}</span>
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {details.status === "active"
              ? "Active"
              : `Done \u00b7 ${
                  details.final_outcome === "offer"
                    ? "Offer"
                    : details.final_outcome === "rejected"
                    ? "Rejected"
                    : "Withdrawn"
                }`}
          </p>
        </div>

        <section className="mb-10">
          <h2 className="mb-3 text-sm text-ink-soft">Rounds</h2>
          <ul>
            {current &&
              (details.status === "active" ? (
                <RecruitmentRow activity={activity} details={details} round={current} />
              ) : (
                <RoundHistoryItem round={current} />
              ))}
            {olderRounds.map((round) => (
              <RoundHistoryItem key={round.id} round={round} />
            ))}
          </ul>
        </section>

        <RecruitmentInsightSection
          title="Company overview"
          activityId={activity.id}
          roundId={current?.id}
          status={companyOverview?.status ?? "missing"}
          error={companyOverview?.error}
        >
          {overviewContent && <InsightFieldList fields={COMPANY_OVERVIEW_FIELDS} content={overviewContent} />}
        </RecruitmentInsightSection>

        {current && (
          <RecruitmentInsightSection
            title="Round prep"
            activityId={activity.id}
            roundId={current.id}
            status={roundPrep?.status ?? "missing"}
            error={roundPrep?.error}
          >
            {roundPrepContent && <InsightFieldList fields={ROUND_PREP_FIELDS} content={roundPrepContent} />}
          </RecruitmentInsightSection>
        )}

        <section>
          <h2 className="mb-3 text-sm text-ink-soft">Chat</h2>
          <RecruitmentChat activityId={activity.id} initialMessages={chatMessages} />
        </section>
      </main>
    </div>
  );
}
