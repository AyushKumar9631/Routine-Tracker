import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { AddActivityDialog } from "@/components/add-activity-dialog";
import { ActivityListItem } from "@/components/activity-list-item";
import { EmptyState } from "@/components/empty-state";
import type { Activity } from "@/lib/types";

export default async function ActivitiesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: true });

  const activities = (data ?? []) as Activity[];

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm text-ink-soft">{activities.length} total</p>
            <h1 className="font-display text-3xl italic text-ink mt-1">Activities</h1>
          </div>
          <AddActivityDialog />
        </div>

        {activities.length === 0 ? (
          <EmptyState
            title="Nothing set up yet"
            description="Define anything you want to track — its schedule and what counts as done."
            action={<AddActivityDialog />}
          />
        ) : (
          <ul>
            {activities.map((activity) => (
              <ActivityListItem key={activity.id} activity={activity} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
