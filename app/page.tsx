import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { ActivityRow } from "@/components/activity-row";
import { LeetcodeCard } from "@/components/leetcode-card";
import { GfgCard } from "@/components/gfg-card";
import { AddActivityDialog } from "@/components/add-activity-dialog";
import { ScreenTimeTodayCard } from "@/components/screentime-today-card";
import { StudyTimerCard } from "@/components/study-timer-card";
import { TodayTopCards } from "@/components/today-top-cards";
import { QuickStopwatchButton } from "@/components/quick-stopwatch-button";
import { QuickStopwatchRow } from "@/components/quick-stopwatch-row";
import { QuickStopwatchCompletedRow } from "@/components/quick-stopwatch-completed-row";
import { EmptyState } from "@/components/empty-state";
import { RecruitmentRow } from "@/components/recruitment-row";
import type {
  Activity,
  Completion,
  QuickStopwatch,
  RecruitmentDetails,
  RecruitmentRound,
  StudyTimerConfig,
} from "@/lib/types";
import { computeScreenTimeStats, recentScreenTimeDays } from "@/lib/screentime";
import { currentRound } from "@/lib/recruitment";
import {
  deadlineFor,
  formatDateKey,
  formatDayLabel,
  isDueOn,
  kolkataToday,
  msUntilDeadline,
  todayKey,
} from "@/lib/utils";

// How far back the dashboard's per-card heatmaps look — a compact ~10-week
// strip, not the full 18-week view used on the activity detail page.
const HEATMAP_DAYS = 70;

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
  const heatmapStart = new Date(today);
  heatmapStart.setDate(heatmapStart.getDate() - HEATMAP_DAYS);
  const heatmapStartKey = formatDateKey(heatmapStart);

  // Recruitment drives are a different `kind` of activity entirely — they
  // never have a period/deadline and must never enter the due-today/done
  // tally below. Pulled out up front, same precedent as Screen Time being
  // pulled out of taskActivities just below.
  const routineActivities = all.filter((a) => a.kind !== "recruitment");
  const recruitmentActivities = all.filter((a) => a.kind === "recruitment");

  // Screen Time and Study Timer are both passive/self-driven top-of-page
  // cards, not rows with a deadline — same reasoning for each, just two
  // different automation types pulled out before the due-today tally.
  const screenTimeActivity = routineActivities.find((a) => a.automation_type === "screen_time") ?? null;
  const studyTimerActivity = routineActivities.find((a) => a.automation_type === "study_timer") ?? null;
  const taskActivities = routineActivities.filter(
    (a) => a.automation_type !== "screen_time" && a.automation_type !== "study_timer"
  );
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

  // Recent history for each due-today card's desktop heatmap — batched into
  // one query rather than one per activity.
  const heatmapByActivity = new Map<string, Completion[]>();
  if (dueToday.length > 0) {
    const { data: heatmapData } = await supabase
      .from("completions")
      .select("*")
      .gte("period_key", heatmapStartKey)
      .in(
        "activity_id",
        dueToday.map((a) => a.id)
      );
    for (const c of (heatmapData ?? []) as Completion[]) {
      const list = heatmapByActivity.get(c.activity_id) ?? [];
      list.push(c);
      heatmapByActivity.set(c.activity_id, list);
    }
  }

  // LeetCode card (components/leetcode-card.tsx) needs its username and
  // today's persisted difficulty — neither lives on the activity row itself.
  const leetcodeConfigByActivity = new Map<
    string,
    { leetcode_username: string | null; last_difficulty: string | null }
  >();
  const leetcodeDueToday = dueToday.filter((a) => a.automation_type === "leetcode_potd");
  if (leetcodeDueToday.length > 0) {
    const { data: leetcodeConfigs } = await supabase
      .from("leetcode_potd_config")
      .select("activity_id, leetcode_username, last_difficulty")
      .in(
        "activity_id",
        leetcodeDueToday.map((a) => a.id)
      );
    for (const c of leetcodeConfigs ?? []) {
      leetcodeConfigByActivity.set(c.activity_id, {
        leetcode_username: c.leetcode_username ?? null,
        last_difficulty: c.last_difficulty ?? null,
      });
    }
  }

  // GFG card (components/gfg-card.tsx) needs its username and today's
  // persisted difficulty — same shape as the LeetCode config just above.
  const gfgConfigByActivity = new Map<
    string,
    { gfg_username: string | null; last_difficulty: string | null }
  >();
  const gfgDueToday = dueToday.filter((a) => a.automation_type === "gfg_potd");
  if (gfgDueToday.length > 0) {
    const { data: gfgConfigs } = await supabase
      .from("gfg_potd_config")
      .select("activity_id, gfg_username, last_difficulty")
      .in(
        "activity_id",
        gfgDueToday.map((a) => a.id)
      );
    for (const c of gfgConfigs ?? []) {
      gfgConfigByActivity.set(c.activity_id, {
        gfg_username: c.gfg_username ?? null,
        last_difficulty: c.last_difficulty ?? null,
      });
    }
  }

  let screenTimeStats = null;
  let screenTimeHistory: { period_key: string; value: number | null }[] = [];
  let screenTimeLastSyncedAt: string | null = null;
  let appUsageToday: { app_name: string; duration_minutes: number; percentage: number }[] = [];
  if (screenTimeActivity) {
    const { data } = await supabase
      .from("completions")
      .select("period_key, value")
      .eq("activity_id", screenTimeActivity.id)
      .order("period_key", { ascending: false })
      .limit(400);
    screenTimeHistory = (data ?? []) as { period_key: string; value: number | null }[];
    screenTimeStats = computeScreenTimeStats(screenTimeHistory, key);

    const { data: config } = await supabase
      .from("screentime_config")
      .select("last_synced_at")
      .eq("activity_id", screenTimeActivity.id)
      .maybeSingle();
    screenTimeLastSyncedAt = config?.last_synced_at ?? null;

    // Fetch today's app-wise usage
    const { data: appUsageData } = await supabase
      .from("app_usage")
      .select("app_name, duration_minutes")
      .eq("date_key", key)
      .not("duration_minutes", "is", null)
      .order("duration_minutes", { ascending: false });

    if (appUsageData && appUsageData.length > 0) {
      const totalMinutes = appUsageData.reduce((sum, app) => sum + (app.duration_minutes ?? 0), 0);
      appUsageToday = appUsageData.map((app) => ({
        app_name: app.app_name,
        duration_minutes: app.duration_minutes ?? 0,
        percentage: totalMinutes > 0 ? Math.round(((app.duration_minutes ?? 0) / totalMinutes) * 100) : 0,
      }));
    }
  }

  let studyTimerConfig: StudyTimerConfig | null = null;
  let studyTimerBaseMinutes = 0;
  if (studyTimerActivity) {
    const { data } = await supabase
      .from("study_timer_config")
      .select("*")
      .eq("activity_id", studyTimerActivity.id)
      .maybeSingle();
    studyTimerConfig = data as StudyTimerConfig | null;

    // While a session is running, its accumulated total lives under
    // whichever day it started on (session_period_key) — normally today,
    // but pinned at Start so a session spanning midnight stays put.
    const basePeriodKey = studyTimerConfig?.session_period_key ?? key;
    const { data: baseCompletion } = await supabase
      .from("completions")
      .select("value")
      .eq("activity_id", studyTimerActivity.id)
      .eq("period_key", basePeriodKey)
      .maybeSingle();
    studyTimerBaseMinutes = (baseCompletion?.value as number | null) ?? 0;
  }

  let studyTimerHeatmap: Completion[] = [];
  if (studyTimerActivity) {
    const { data } = await supabase
      .from("completions")
      .select("*")
      .eq("activity_id", studyTimerActivity.id)
      .gte("period_key", heatmapStartKey);
    studyTimerHeatmap = (data ?? []) as Completion[];
  }

  // Quick Stopwatch is a separate, un-scheduled utility — not in
  // `activities` at all, so it never touches taskActivities/dueToday or the
  // "X of Y done" tally. Active (running/paused) ones aren't day-scoped;
  // period_key is only assigned once one is completed.
  const { data: activeStopwatchRows } = await supabase
    .from("quick_stopwatches")
    .select("*")
    .in("status", ["running", "paused"])
    .order("created_at", { ascending: true });
  const activeStopwatches = (activeStopwatchRows ?? []) as QuickStopwatch[];

  const { data: completedStopwatchRows } = await supabase
    .from("quick_stopwatches")
    .select("*")
    .eq("status", "completed")
    .eq("period_key", key)
    .order("completed_at", { ascending: false });
  const completedStopwatches = (completedStopwatchRows ?? []) as QuickStopwatch[];

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

  // Routes each due-today activity to its card: LeetCode POTD and GFG POTD
  // get their themed cards (components/leetcode-card.tsx,
  // components/gfg-card.tsx), everything else still gets the shared
  // ActivityRow — until each automation type gets its own redesign in a
  // later turn.
  function renderActivityCard(activity: Activity) {
    const completion = completionByActivity.get(activity.id) ?? null;
    const heatmap = heatmapByActivity.get(activity.id) ?? [];

    if (activity.automation_type === "leetcode_potd") {
      const config = leetcodeConfigByActivity.get(activity.id);
      return (
        <LeetcodeCard
          key={activity.id}
          activity={activity}
          completion={completion}
          periodKey={key}
          heatmapCompletions={heatmap}
          leetcodeUsername={config?.leetcode_username ?? null}
          difficulty={config?.last_difficulty ?? null}
        />
      );
    }

    if (activity.automation_type === "gfg_potd") {
      const config = gfgConfigByActivity.get(activity.id);
      return (
        <GfgCard
          key={activity.id}
          activity={activity}
          completion={completion}
          periodKey={key}
          heatmapCompletions={heatmap}
          gfgUsername={config?.gfg_username ?? null}
          difficulty={config?.last_difficulty ?? null}
        />
      );
    }

    return (
      <ActivityRow
        key={activity.id}
        activity={activity}
        completion={completion}
        periodKey={key}
        deadline={deadlineFor(activity, now)?.toISOString() ?? null}
        heatmapCompletions={heatmap}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="mx-auto max-w-3xl px-6 py-10 lg:max-w-6xl">{/* lg:max-w-6xl gives the card grid room to breathe on desktop */}
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
          <div className="flex items-center gap-2">
            <QuickStopwatchButton />
            <AddActivityDialog />
          </div>
        </div>

        <TodayTopCards
          items={[
            ...(screenTimeActivity && screenTimeStats
              ? [
                  {
                    id: "screen-time",
                    node: (
                      <ScreenTimeTodayCard
                        activity={screenTimeActivity}
                        stats={screenTimeStats}
                        lastSyncedAt={screenTimeLastSyncedAt}
                        history={screenTimeHistory}
                        todayDateKey={key}
                        appUsage={appUsageToday}
                      />
                    ),
                  },
                ]
              : []),
            ...(studyTimerActivity
              ? [
                  {
                    id: "study-timer",
                    node: (
                      <StudyTimerCard
                        activityId={studyTimerActivity.id}
                        activityName={studyTimerActivity.name}
                        activityIcon={studyTimerActivity.icon}
                        goalMinutes={studyTimerActivity.target_value}
                        runningSince={studyTimerConfig?.running_since ?? null}
                        baseMinutes={studyTimerBaseMinutes}
                        notifyOnGoal={studyTimerConfig?.notify_on_goal ?? true}
                        activity={studyTimerActivity}
                        heatmapCompletions={studyTimerHeatmap}
                      />
                    ),
                  },
                ]
              : []),
            ...activeStopwatches.map((sw) => ({
              id: `quick-stopwatch-${sw.id}`,
              node: (
                <QuickStopwatchRow
                  id={sw.id}
                  label={sw.label}
                  status={sw.status as "running" | "paused"}
                  accumulatedSeconds={sw.accumulated_seconds}
                  runningSince={sw.running_since}
                />
              ),
            })),
          ]}
        />

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
          <ul className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 xl:grid-cols-3">
            {uncompletedToday.map(renderActivityCard)}
          </ul>
        )}

        {/*
          Deliberately outside the ternary above: a Quick Stopwatch isn't a
          routine activity at all, so it can have completions today even on
          a day with nothing scheduled (or no activities yet) — it must
          never be hidden by, or feed into, the routine done/total tally.
        */}
        {(completedToday.length > 0 || completedStopwatches.length > 0) && (
          <div className="mt-10">
            <div className="mb-1 flex items-center gap-3">
              <h2 className="shrink-0 text-xs text-ink-soft">Completed ({completedToday.length})</h2>
              <div className="h-px flex-1 bg-line" />
            </div>
            <ul className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 xl:grid-cols-3">
              {completedToday.map(renderActivityCard)}
              {completedStopwatches.map((sw) => (
                <QuickStopwatchCompletedRow
                  key={sw.id}
                  label={sw.label}
                  accumulatedSeconds={sw.accumulated_seconds}
                />
              ))}
            </ul>
          </div>
        )}

        {/*
          Deliberately outside the ternary above: a recruitment drive can be
          active whether or not anything routine is due today, and it must
          never affect the "Nothing on the log today" / "Clear day" copy or
          the done/total tally, which are both about routine activities only.
        */}
        {activeDrives.length > 0 && (
          <div className="mt-10">
            <div className="mb-1 flex items-center gap-3">
              <h2 className="shrink-0 text-xs text-ink-soft">Recruitment ({activeDrives.length})</h2>
              <div className="h-px flex-1 bg-line" />
              <Link
                href="/activities/recruitment"
                className="shrink-0 text-xs text-ink-soft hover:text-ink hover:underline underline-offset-2"
              >
                View full history
              </Link>
            </div>
            <ul>
              {activeDrives.map(({ activity, details, round }) => (
                <RecruitmentRow key={activity.id} activity={activity} details={details} round={round} />
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
