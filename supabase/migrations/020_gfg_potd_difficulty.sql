-- Persists today's GFG POTD title/difficulty alongside the existing sync
-- cursor, mirroring 019_leetcode_potd_difficulty.sql for the LeetCode card.
-- GFG has no public per-problem API (see lib/gfg.ts), so this is filled by
-- a best-effort scrape of the public Problem of the Day page rather than a
-- documented endpoint — same idea as the streak scrape, just a different
-- page.
alter table gfg_potd_config
  add column if not exists last_difficulty text,
  add column if not exists last_title text;
