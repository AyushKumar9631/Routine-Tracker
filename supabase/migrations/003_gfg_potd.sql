-- GFG Daily Challenge automation.
-- Run this in the Supabase SQL editor after 002_leetcode_potd.sql.
-- GFG has no public API with per-submission timestamps like LeetCode's, so
-- this table stores a streak counter cursor instead of a slug/date cursor.
-- See lib/gfg-sync.ts for the delta-detection logic this feeds.

create table if not exists gfg_potd_config (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  gfg_username text not null,

  -- sync cursor, updated by every check (manual or cron)
  last_checked_at timestamptz,
  last_known_streak integer,   -- streak value observed at the last check
  last_synced_date date,       -- most recent IST date confirmed solved

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gfg_potd_config_user_id_idx on gfg_potd_config (user_id);

drop trigger if exists gfg_potd_config_set_updated_at on gfg_potd_config;
create trigger gfg_potd_config_set_updated_at
  before update on gfg_potd_config
  for each row execute function set_updated_at();

alter table gfg_potd_config enable row level security;

create policy "Users manage their own gfg config"
  on gfg_potd_config for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
