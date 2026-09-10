-- LeetCode POTD deadline notifications: config columns.
-- Run after 005_pg_cron_leetcode.sql.
-- preferred_complete_by: optional user-set "notify me by" time-of-day
--   (Asia/Kolkata wall clock). If null, threshold defaults to deadline
--   minus 2h at check-time (see lib/deadlines.ts) — not resolved here.
-- last_notified_on: date, not boolean. Setting it to today after a
--   confirmed-successful send both blocks resend and self-resets when
--   the date rolls over — no separate cleanup job needed.

alter table leetcode_potd_config
  add column if not exists preferred_complete_by time,
  add column if not exists last_notified_on date;
