import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { ActivityIcon } from "@/components/activity-icon";
import { RecruitmentRow } from "@/components/recruitment-row";
import { currentRound, RESULT_LABELS, ROUND_TYPE_LABELS, sortRounds } from "@/lib/recruitment";
import type { Activity, RecruitmentDetails, RecruitmentRound } from "@/lib/types";
import { cn } from "@/lib/utils";

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

        {/* TODO(Phase F): company overview (recruitment_ai_insights, kind='company_overview')
            pending/ready/failed states land here — see plan doc task F4. */}
        <section className="mb-10">
          <h2 className="mb-3 text-sm text-ink-soft">Company overview</h2>
          <p className="text-sm text-ink-soft">AI research coming soon.</p>
        </section>

        {/* TODO(Phase F): round prep for the current round (recruitment_ai_insights,
            kind='round_prep', round_id=current.id) lands here — see task F4. */}
        <section className="mb-10">
          <h2 className="mb-3 text-sm text-ink-soft">Round prep</h2>
          <p className="text-sm text-ink-soft">AI research coming soon.</p>
        </section>

        {/* TODO(Phase G): recruitment-chat.tsx (recruitment_chat_messages) lands
            here — see plan doc tasks G1/G2. */}
        <section>
          <h2 className="mb-3 text-sm text-ink-soft">Chat</h2>
          <p className="text-sm text-ink-soft">Chat assistant coming soon.</p>
        </section>
      </main>
    </div>
  );
}
