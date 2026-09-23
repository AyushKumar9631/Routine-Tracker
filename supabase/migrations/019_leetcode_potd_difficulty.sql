-- Persists today's LeetCode POTD title/difficulty alongside the existing
-- sync cursor, so the dashboard card can show it without an extra client
-- round-trip to LeetCode's API on every render.
alter table leetcode_potd_config
  add column if not exists last_difficulty text,
  add column if not exists last_title text;
