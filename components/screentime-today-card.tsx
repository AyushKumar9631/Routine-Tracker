import { ActivityIcon } from "@/components/activity-icon";
import { ScreenTimeGauge } from "@/components/screentime-gauge";
import { formatScreenTimeLong, type ScreenTimeStats } from "@/lib/screentime";
import type { Activity } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

export function ScreenTimeTodayCard({
  activity,
  stats,
  lastSyncedAt,
}: {
  activity: Activity;
  stats: ScreenTimeStats;
  lastSyncedAt: string | null;
}) {
  return (
    <div className="mb-6 rounded border border-line bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActivityIcon icon={activity.icon} className="text-base" />
          <span className="text-sm text-ink-soft">{activity.name}</span>
        </div>
        <span className="text-xs text-ink-soft">Last synced {formatRelativeTime(lastSyncedAt)}</span>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="w-full shrink-0 sm:w-[190px]">
          <ScreenTimeGauge minutes={stats.todayMinutes ?? 0} limitMinutes={activity.target_value} />
        </div>

        <div className="w-full divide-y divide-line sm:pl-6">
          <StatRow label="Weekly average" value={formatScreenTimeLong(stats.weeklyAverageMinutes)} />
          <StatRow label="Monthly average" value={formatScreenTimeLong(stats.monthlyAverageMinutes)} />
          <StatRow label="Week lowest" value={formatScreenTimeLong(stats.weekLowestMinutes)} />
        </div>
      </div>
    </div>
  );
}
