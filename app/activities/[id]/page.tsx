import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { EditActivityDialog } from "@/components/edit-activity-dialog";
import { StatPill } from "@/components/stat-pill";
import { CompletionHeatmap } from "@/components/completion-heatmap";
import { EmptyState } from "@/components/empty-state";
import type { Activity, Completion } from "@/lib/types";
import { calcCompletionRate, calcStreak, formatDateKey, parseDateKey, scheduleLabel } from "@/lib/utils";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: activity } = await supabase
    .from("activities")
    .select("*")
    .eq("id", id)
    .single();

  if (!activity) notFound();

  const { data: completionsData } = await supabase
    .from("completions")
    .select("*")
    .eq("activity_id", id)
    .order("period_key", { ascending: false })
    .limit(500);

  const typedActivity = activity as Activity;
  const completions = (completionsData ?? []) as Completion[];

  const streak = calcStreak(typedActivity, completions);
  const rate30 = calcCompletionRate(typedActivity, completions, 30);
  const totalDone = completions.filter((c) => c.completed).length;

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/activities" className="text-sm text-ink-soft hover:text-ink">
          &larr; Activities
        </Link>

        <div className="mb-8 mt-3 flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl italic text-ink">
              <span className="mr-2">{typedActivity.icon}</span>
              {typedActivity.name}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">{scheduleLabel(typedActivity)}</p>
            {typedActivity.description && (
              <p className="mt-2 max-w-md text-sm text-ink-soft">{typedActivity.description}</p>
            )}
          </div>
          <EditActivityDialog activity={typedActivity} />
        </div>

        <div className="mb-10 grid grid-cols-3 gap-3">
          <StatPill label="current streak" value={String(streak)} />
          <StatPill label="last 30 days" value={`${rate30}%`} />
          <StatPill label="times completed" value={String(totalDone)} />
        </div>

        <section className="mb-10">
          <h2 className="mb-3 text-sm text-ink-soft">History</h2>
          <CompletionHeatmap activity={typedActivity} completions={completions} />
        </section>

        <section>
          <h2 className="mb-3 text-sm text-ink-soft">Recent log</h2>
          {completions.length === 0 ? (
            <EmptyState
              title="No entries yet"
              description="Once you log this from Today, its history will show up here."
            />
          ) : (
            <ul>
              {completions.slice(0, 14).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between border-b border-line py-3 text-sm last:border-b-0"
                >
                  <span className="font-mono text-ink-soft">
                    {formatDateKey(parseDateKey(c.period_key)) === c.period_key
                      ? new Date(c.period_key).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : c.period_key}
                  </span>
                  <span className={c.completed ? "text-moss" : "text-rust"}>
                    {typedActivity.completion_type === "count"
                      ? `${c.value ?? 0} / ${typedActivity.target_value}${
                          typedActivity.unit_label ? ` ${typedActivity.unit_label}` : ""
                        }`
                      : c.completed
                      ? "Done"
                      : "Not done"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
