import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { EmptyState } from "@/components/empty-state";
import { RESULT_LABELS, ROUND_TYPE_LABELS, sortRounds } from "@/lib/recruitment";
import type { Activity, RecruitmentDetails, RecruitmentRound } from "@/lib/types";

export default async function RecruitmentHistoryPage() {
  const supabase = await createClient();

  const { data: activitiesData } = await supabase
    .from("activities")
    .select("*")
    .eq("kind", "recruitment")
    .order("created_at", { ascending: true });
  const activities = (activitiesData ?? []) as Activity[];

  let detailsByActivity = new Map<string, RecruitmentDetails>();
  let roundsByActivity = new Map<string, RecruitmentRound[]>();

  if (activities.length > 0) {
    const activityIds = activities.map((a) => a.id);

    const { data: detailsData } = await supabase
      .from("recruitment_details")
      .select("*")
      .in("activity_id", activityIds);
    detailsByActivity = new Map(
      ((detailsData ?? []) as RecruitmentDetails[]).map((d) => [d.activity_id, d])
    );

    const { data: roundsData } = await supabase
      .from("recruitment_rounds")
      .select("*")
      .in("activity_id", activityIds);
    for (const round of (roundsData ?? []) as RecruitmentRound[]) {
      const list = roundsByActivity.get(round.activity_id) ?? [];
      list.push(round);
      roundsByActivity.set(round.activity_id, list);
    }
  }

  const drives = activities
    .map((activity) => {
      const details = detailsByActivity.get(activity.id);
      if (!details) return null;
      const rounds = sortRounds(roundsByActivity.get(activity.id) ?? []);
      return { activity, details, rounds };
    })
    .filter((d): d is { activity: Activity; details: RecruitmentDetails; rounds: RecruitmentRound[] } => d !== null);

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/" className="text-sm text-ink-soft hover:text-ink">
          &larr; Today
        </Link>

        <div className="mb-8 mt-3">
          <p className="text-sm text-ink-soft">{drives.length} total</p>
          <h1 className="font-display text-3xl italic text-ink mt-1">Recruitment History</h1>
        </div>

        {drives.length === 0 ? (
          <EmptyState
            title="No recruitment drives yet"
            description="Add one from the Today page to start tracking a company's rounds and results here."
          />
        ) : (
          <ul>
            {drives.map(({ activity, details, rounds }) => (
              <li key={activity.id} className="border-b border-line py-4 last:border-b-0">
                <Link
                  href={`/activities/recruitment/${activity.id}`}
                  className="block text-sm text-ink hover:underline underline-offset-2"
                >
                  {details.company_name}
                  <span className="text-ink-soft"> &mdash; {details.role}</span>
                </Link>
                <p className="mt-0.5 text-xs text-ink-soft">
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

                <ul className="mt-2 space-y-0.5">
                  {rounds.map((round) => (
                    <li key={round.id} className="text-xs text-ink-soft">
                      Round {round.round_no} &middot; {ROUND_TYPE_LABELS[round.round_type]} &middot;{" "}
                      {RESULT_LABELS[round.result]}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
