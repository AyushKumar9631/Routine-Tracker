import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { ActivityRow } from "@/components/activity-row";
import { AddActivityDialog } from "@/components/add-activity-dialog";
import { EmptyState } from "@/components/empty-state";
import type { Activity, Completion } from "@/lib/types";
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
  const dueToday = all.filter((a) => isDueOn(a, today));
  const key = todayKey(now);

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

        <div className="mb-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-ink-soft">{formatDayLabel(today)}</p>
              <h1 className="font-display text-3xl italic text-ink mt-1">
                {dueToday.length === 0
                  ? "Nothing on the log today"
                  : `${doneCount} of ${dueToday.length} done`}
              </h1>
            </div>
            <AddActivityDialog />
          </div>

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
      </main>
    </div>
  );
}
