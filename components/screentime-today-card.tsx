import { ActivityIcon } from "@/components/activity-icon";
import { ScreenTimeGauge } from "@/components/screentime-gauge";
import { formatScreenTime, type ScreenTimeStats } from "@/lib/screentime";
import type { Activity } from "@/lib/types";

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
}: {
  activity: Activity;
  stats: ScreenTimeStats;
}) {
  return (
    <div className="mb-6 rounded border border-line bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActivityIcon icon={activity.icon} className="text-base" />
          <span className="text-sm text-ink-soft">{activity.name}</span>
        </div>
        {activity.target_value != null && (
          <span className="text-xs text-ink-soft">
            limit {formatScreenTime(activity.target_value)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="w-full shrink-0 sm:w-[190px]">
          <ScreenTimeGauge minutes={stats.todayMinutes ?? 0} limitMinutes={activity.target_value} />
        </div>

        <div className="w-full divide-y divide-line sm:pl-6">
          <StatRow label="Weekly average" value={formatScreenTime(stats.weeklyAverageMinutes)} />
          <StatRow label="Overall average" value={formatScreenTime(stats.overallAverageMinutes)} />
          <StatRow label="Week lowest" value={formatScreenTime(stats.weekLowestMinutes)} />
        </div>
      </div>
    </div>
  );
}
