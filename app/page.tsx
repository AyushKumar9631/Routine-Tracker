import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { ActivityRow } from "@/components/activity-row";
import { AddActivityDialog } from "@/components/add-activity-dialog";
import { ScreenTimeTodayCard } from "@/components/screentime-today-card";
import { EmptyState } from "@/components/empty-state";
import type { Activity, Completion, RecruitmentDetails, RecruitmentRound } from "@/lib/types";
import { computeScreenTimeStats } from "@/lib/screentime";
import { currentRound, ROUND_TYPE_LABELS } from "@/lib/recruitment";
import { deadlineFor, formatDayLabel, isDueOn, kolkataToday, msUntilDeadline, todayKey } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const needsPassword = Boolean(user) && !user?.user_metadata?.has_password;

  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const all = (activities ?? []) as Activity[];
  const now = new Date();
  const today = kolkataToday(now);
  const key = todayKey(now);

  // Recruitment drives are a different `kind` of activity entirely — they
  // never have a period/deadline and must never enter the due-today/done
  // tally below. Pulled out up front, same precedent as Screen Time being
  // pulled out of taskActivities just below.
  const routineActivities = all.filter((a) => a.kind !== "recruitment");
  const recruitmentActivities = all.filter((a) => a.kind === "recruitment");

  // Screen Time is a passive daily readout, not a task with a deadline — it
  // gets its own gauge card up top instead of a row in the log below.
  const screenTimeActivity = routineActivities.find((a) => a.automation_type === "screen_time") ?? null;
  const taskActivities = routineActivities.filter((a) => a.automation_type !== "screen_time");
  const dueToday = taskActivities.filter((a) => isDueOn(a, today));

  let completions: Completion[] = [];
  if (dueToday.length > 0) {
    const { data } = await supabase
      .from("completions")
      .select("*")
      .eq("period_key", key)
      .in(
        "activity_id",
        dueToday.map((a) => a.id)
      );
    completions = (data ?? []) as Completion[];
  }

  let screenTimeStats = null;
  let screenTimeLastSyncedAt: string | null = null;
  if (screenTimeActivity) {
    const { data } = await supabase
      .from("completions")
      .select("period_key, value")
      .eq("activity_id", screenTimeActivity.id)
      .order("period_key", { ascending: false })
      .limit(400);
    screenTimeStats = computeScreenTimeStats(
      (data ?? []) as { period_key: string; value: number | null }[],
      key
    );

    const { data: config } = await supabase
      .from("screentime_config")
      .select("last_synced_at")
      .eq("activity_id", screenTimeActivity.id)
      .maybeSingle();
    screenTimeLastSyncedAt = config?.last_synced_at ?? null;
  }

  // Active recruitment drives + each one's current round. A drive only shows
  // here while recruitment_details.status = 'active' — once rejected or
  // turned into an offer it drops out of Today and only appears in history
  // (a later task).
  type ActiveDrive = { activity: Activity; details: RecruitmentDetails; round: RecruitmentRound };
  let activeDrives: ActiveDrive[] = [];

  if (recruitmentActivities.length > 0) {
    const recruitmentIds = recruitmentActivities.map((a) => a.id);

    const { data: detailsData } = await supabase
      .from("recruitment_details")
      .select("*")
      .in("activity_id", recruitmentIds)
      .eq("status", "active");
    const activeDetails = (detailsData ?? []) as RecruitmentDetails[];
    const activeIds = activeDetails.map((d) => d.activity_id);

    const roundsByActivity = new Map<string, RecruitmentRound[]>();
    if (activeIds.length > 0) {
      const { data: roundsData } = await supabase
        .from("recruitment_rounds")
        .select("*")
        .in("activity_id", activeIds);
      for (const round of (roundsData ?? []) as RecruitmentRound[]) {
        const list = roundsByActivity.get(round.activity_id) ?? [];
        list.push(round);
        roundsByActivity.set(round.activity_id, list);
      }
    }

    const activityById = new Map(recruitmentActivities.map((a) => [a.id, a]));
    const detailsByActivity = new Map(activeDetails.map((d) => [d.activity_id, d]));

    activeDrives = activeIds
      .map((id) => {
        const activity = activityById.get(id);
        const details = detailsByActivity.get(id);
        const round = currentRound(roundsByActivity.get(id) ?? []);
        if (!activity || !details || !round) return null;
        return { activity, details, round };
      })
      .filter((d): d is ActiveDrive => d !== null);
  }

  const completionByActivity = new Map(completions.map((c) => [c.activity_id, c]));
  const doneCount = dueToday.filter((a) => completionByActivity.get(a.id)?.completed).length;

  const uncompletedToday = dueToday
    .filter((a) => !completionByActivity.get(a.id)?.completed)
    .sort((a, b) => (msUntilDeadline(a, now) ?? Infinity) - (msUntilDeadline(b, now) ?? Infinity));
  const completedToday = dueToday.filter((a) => completionByActivity.get(a.id)?.completed);

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="mx-auto max-w-3xl px-6 py-10">
        {needsPassword && (
          <div className="mb-8 flex items-center justify-between gap-4 rounded border border-amber/40 bg-amber-soft px-4 py-3 text-sm text-ink">
            <span>You're signed in via a one-time link. Set a password to skip the email step next time.</span>
            <Link
              href="/account/set-password"
              className="shrink-0 whitespace-nowrap font-medium text-ink underline underline-offset-2 hover:text-moss"
            >
              Set password
            </Link>
          </div>
        )}

        <div className="mb-6 flex items-end justify-between">
          <p className="text-sm text-ink-soft">{formatDayLabel(today)}</p>
          <AddActivityDialog />
        </div>

        {screenTimeActivity && screenTimeStats && (
          <ScreenTimeTodayCard
            activity={screenTimeActivity}
            stats={screenTimeStats}
            lastSyncedAt={screenTimeLastSyncedAt}
          />
        )}

        <div className="mb-8">
          <h1 className="font-display text-3xl italic text-ink">
            {dueToday.length === 0
              ? "Nothing on the log today"
              : `${doneCount} of ${dueToday.length} done`}
          </h1>

          {dueToday.length > 0 && (
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-moss transition-[width] duration-500 ease-out"
                style={{ width: `${Math.round((doneCount / dueToday.length) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {all.length === 0 ? (
          <EmptyState
            title="No activities yet"
            description="Add the first thing you want to track — a daily habit, a weekly contest, anything with a rhythm."
            action={<AddActivityDialog />}
          />
        ) : dueToday.length === 0 ? (
          <EmptyState
            title="Clear day"
            description="Nothing is scheduled for today. Check Activities to see what's coming up."
          />
        ) : (
          <>
            <ul>
              {uncompletedToday.map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  completion={completionByActivity.get(activity.id) ?? null}
                  periodKey={key}
                  deadline={deadlineFor(activity, now)?.toISOString() ?? null}
                />
              ))}
            </ul>

            {completedToday.length > 0 && (
              <div className="mt-10">
                <div className="mb-1 flex items-center gap-3">
                  <h2 className="shrink-0 text-xs text-ink-soft">
                    Completed ({completedToday.length})
                  </h2>
                  <div className="h-px flex-1 bg-line" />
                </div>
                <ul>
                  {completedToday.map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      completion={completionByActivity.get(activity.id) ?? null}
                      periodKey={key}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/*
          Deliberately outside the ternary above: a recruitment drive can be
          active whether or not anything routine is due today, and it must
          never affect the "Nothing on the log today" / "Clear day" copy or
          the done/total tally, which are both about routine activities only.

          NOTE(Task C2): this renders a plain placeholder row for now. C2
          replaces it with a real <RecruitmentRow /> (countdown, inline
          "set the date" control, "Log result" action) — see the plan doc.
        */}
        {activeDrives.length > 0 && (
          <div className="mt-10">
            <div className="mb-1 flex items-center gap-3">
              <h2 className="shrink-0 text-xs text-ink-soft">Recruitment ({activeDrives.length})</h2>
              <div className="h-px flex-1 bg-line" />
            </div>
            <ul>
              {activeDrives.map(({ activity, details, round }) => (
                <li key={activity.id} className="border-b border-line py-3">
                  <p className="text-sm text-ink">
                    {details.company_name}{" "}
                    <span className="text-ink-soft">&mdash; {details.role}</span>
                  </p>
                  <p className="text-xs text-ink-soft">
                    Round {round.round_no} &middot; {ROUND_TYPE_LABELS[round.round_type]}
                    {round.test_date ? ` \u00b7 ${round.test_date}` : " \u00b7 no date set yet"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
