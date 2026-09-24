import { ActivityIcon } from "@/components/activity-icon";
import { ScreenTimeGauge } from "@/components/screentime-gauge";
import {
  GAUGE_OVERSHOOT,
  formatScreenTimeLong,
  recentScreenTimeDays,
  screenTimeLevel,
  type ScreenTimeLevel,
  type ScreenTimeStats,
} from "@/lib/screentime";
import type { Activity } from "@/lib/types";
import { cn, formatRelativeTime } from "@/lib/utils";

const LEVEL_BAR: Record<ScreenTimeLevel, string> = {
  moss: "bg-moss",
  amber: "bg-amber",
  rust: "bg-rust",
};

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

function TrendBadge({
  todayMinutes,
  weeklyAverageMinutes,
}: {
  todayMinutes: number | null;
  weeklyAverageMinutes: number | null;
}) {
  if (todayMinutes == null || !weeklyAverageMinutes) return null;
  const pct = Math.round(((todayMinutes - weeklyAverageMinutes) / weeklyAverageMinutes) * 100);
  if (pct === 0) return <span className="text-xs text-ink-soft">On par with your weekly average</span>;
  const down = pct < 0;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", down ? "text-moss" : "text-rust")}>
      <span aria-hidden="true">{down ? "▾" : "▴"}</span>
      {Math.abs(pct)}% {down ? "below" : "above"} weekly average
    </span>
  );
}

interface AppUsageData {
  app_name: string;
  duration_minutes: number;
  percentage: number;
}

export function ScreenTimeTodayCard({
  activity,
  stats,
  lastSyncedAt,
  history = [],
  todayDateKey,
  appUsage = [],
}: {
  activity: Activity;
  stats: ScreenTimeStats;
  lastSyncedAt: string | null;
  history?: { period_key: string; value: number | null }[];
  todayDateKey: string;
  appUsage?: AppUsageData[];
}) {
  const days = recentScreenTimeDays(history, todayDateKey, 14);
  const scale = activity.target_value ? activity.target_value * GAUGE_OVERSHOOT : 240;

  return (
    <div className="card-interactive mb-6 rounded border border-line bg-card p-5 lg:rounded-xl">
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
          <div className="mt-1 text-center">
            <TrendBadge todayMinutes={stats.todayMinutes} weeklyAverageMinutes={stats.weeklyAverageMinutes} />
          </div>
        </div>

        <div className="w-full divide-y divide-line sm:pl-6">
          <StatRow label="Weekly average" value={formatScreenTimeLong(stats.weeklyAverageMinutes)} />
          <StatRow label="Monthly average" value={formatScreenTimeLong(stats.monthlyAverageMinutes)} />
          <StatRow label="Week lowest" value={formatScreenTimeLong(stats.weekLowestMinutes)} />
        </div>
      </div>

      {/* App-wise breakdown */}
      {appUsage.length > 0 && (
        <div className="mt-5 border-t border-line/70 pt-4">
          <p className="mb-3 text-xs uppercase tracking-wider text-ink-soft">Today's apps</p>
          <div className="space-y-2">
            {appUsage.slice(0, 5).map((app) => (
              <div key={app.app_name} className="flex items-center justify-between text-sm">
                <span className="text-ink">{app.app_name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-ink-soft">{formatScreenTimeLong(app.duration_minutes)}</span>
                  <span className="w-10 text-right text-xs text-ink-soft">{app.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
          {appUsage.length > 5 && (
            <p className="mt-2 text-xs text-ink-soft">+ {appUsage.length - 5} more apps</p>
          )}
        </div>
      )}

      {/* Desktop-only heat strip */}
      <div className="hidden lg:block lg:mt-5 lg:border-t lg:border-line/70 lg:pt-4">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-ink-soft">Last 14 days</p>
        <div className="flex h-12 items-end gap-1.5">
          {days.map((d, i) => {
            const level = d.minutes == null ? null : screenTimeLevel(d.minutes, activity.target_value);
            const heightPct = d.minutes == null ? 6 : Math.max(8, Math.min(100, (d.minutes / scale) * 100));
            return (
              <div
                key={d.key}
                title={`${d.key}: ${formatScreenTimeLong(d.minutes)}`}
                className={cn(
                  "animate-heat-pop flex-1 rounded-t-sm transition-all duration-300 hover:opacity-75",
                  d.minutes == null ? "bg-line/40" : LEVEL_BAR[level as ScreenTimeLevel]
                )}
                style={{ height: `${heightPct}%`, animationDelay: `${i * 25}ms` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
