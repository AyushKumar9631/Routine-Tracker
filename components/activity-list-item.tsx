"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toggleActivityActive } from "@/actions/activities";
import { EditActivityDialog } from "@/components/edit-activity-dialog";
import type { Activity } from "@/lib/types";
import { cn, scheduleLabel } from "@/lib/utils";

export function ActivityListItem({ activity }: { activity: Activity }) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await toggleActivityActive(activity.id, !activity.is_active);
    });
  }

  return (
    <li
      className={cn(
        "flex items-center gap-4 border-b border-line py-4 last:border-b-0",
        !activity.is_active && "opacity-50"
      )}
    >
      <span className="text-lg">{activity.icon}</span>

      <div className="min-w-0 flex-1">
        <Link
          href={`/activities/${activity.id}`}
          className="block truncate text-sm text-ink hover:underline underline-offset-2"
        >
          {activity.name}
        </Link>
        <p className="mt-0.5 text-xs text-ink-soft">
          {scheduleLabel(activity)}
          {activity.completion_type === "count" &&
            ` \u00b7 target ${activity.target_value}${
              activity.unit_label ? ` ${activity.unit_label}` : ""
            }`}
        </p>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className="text-xs text-ink-soft hover:text-ink disabled:opacity-50"
      >
        {activity.is_active ? "Active" : "Paused"}
      </button>

      <EditActivityDialog activity={activity} />
    </li>
  );
}
