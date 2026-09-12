-- Screen time budget-threshold notifications: config columns.
-- Run after 012_pg_cron_gfg_notify.sql.
-- Unlike LeetCode/GFG notify (pg_cron polling), screen time has no
-- scheduler: it only ever fires from inside the webhook route
-- (app/api/screentime/[token]/route.ts) when the iPhone Shortcut pushes a
-- new value, whether that's the existing end-of-day sync or the newer
-- most-used-app-opened syncs. Three fixed thresholds (90/110/150% of the
-- activity's target_value budget), each independently gated by its own
-- last_notified_on date so a threshold fires at most once per calendar day
-- regardless of how many syncs land that day.
-- notification_template columns mirror 006/009/011's null = use default pattern.

alter table screentime_config
  add column if not exists notify_90_template text,
  add column if not exists notify_110_template text,
  add column if not exists notify_150_template text,
  add column if not exists last_notified_90_on date,
  add column if not exists last_notified_110_on date,
  add column if not exists last_notified_150_on date;
