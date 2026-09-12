-- GFG POTD deadline notifications: config columns.
-- Run after 010_leetcode_notify_sql_gate.sql. Mirrors 006/009's LeetCode
-- columns (see those files for the per-column rationale) so gfg_potd_config
-- can drive the same deadline-notify flow.
--
-- notification_template placeholders here are {streak} only — GFG's public
-- API doesn't expose the POTD's title/difficulty like LeetCode's does (see
-- lib/gfg.ts), so there's no {question}/{number}/{difficulty} equivalent.

alter table gfg_potd_config
  add column if not exists preferred_complete_by time,
  add column if not exists last_notified_on date,
  add column if not exists notification_template text;
