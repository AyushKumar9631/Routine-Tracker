-- LeetCode Daily Challenge automation.
-- Run this in the Supabase SQL editor after schema.sql.
-- Separate table (not the generic automation_config jsonb column) so the
-- username + sync cursor for this specific integration are easy to query,
-- index, and reason about on their own.

create table if not exists leetcode_potd_config (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  leetcode_username text not null,

  -- sync cursor, updated by every check (manual or cron)
  last_checked_at timestamptz,
  last_synced_date date,     -- most recent POTD date confirmed solved
  last_question_slug text,   -- most recent POTD slug seen, solved or not

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leetcode_potd_config_user_id_idx on leetcode_potd_config (user_id);

drop trigger if exists leetcode_potd_config_set_updated_at on leetcode_potd_config;
create trigger leetcode_potd_config_set_updated_at
  before update on leetcode_potd_config
  for each row execute function set_updated_at();

alter table leetcode_potd_config enable row level security;

create policy "Users manage their own leetcode config"
  on leetcode_potd_config for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
