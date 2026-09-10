import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { ActivityRow } from "@/components/activity-row";
import { AddActivityDialog } from "@/components/add-activity-dialog";
import { EmptyState } from "@/components/empty-state";
import type { Activity, Completion } from "@/lib/types";
import { deadlineFor, formatDayLabel, isDueOn, msUntilDeadline, todayKey } from "@/lib/utils";

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
  const today = new Date();
  const dueToday = all.filter((a) => isDueOn(a, today));
  const key = todayKey();

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
    .sort((a, b) => (msUntilDeadline(a, today) ?? Infinity) - (msUntilDeadline(b, today) ?? Infinity));
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

        <div className="mb-8 flex items-end justify-between">
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
                  deadline={deadlineFor(activity, today)?.toISOString() ?? null}
                />
              ))}
            </ul>

            {completedToday.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-2 text-xs uppercase tracking-wide text-ink-soft">
                  Completed &middot; {completedToday.length}
                </h2>
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
