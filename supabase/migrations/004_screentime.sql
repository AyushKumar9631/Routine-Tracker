-- The count_requires_target constraint on activities predates this feature:
-- screen time is completion_type='count' but its target_value (a daily
-- budget) is optional, so relax the constraint for automated activities.
alter table activities drop constraint if exists count_requires_target;
alter table activities add constraint count_requires_target check (
  completion_type <> 'count' or target_value is not null or is_automated
);

-- Smartphone Screen Time automation.
-- Run this in the Supabase SQL editor after 003_gfg_potd.sql.
-- Unlike the POTD integrations (server polls a public API by username),
-- screen time has no public API: data only arrives via an iOS Shortcut
-- PUSHing a value to a per-activity webhook. There's no interactive session
-- on that request to check auth.uid() against, so the token in the URL path
-- IS the auth — the ingestion route looks up this row by token using the
-- service-role client, the same way the cron routes bypass RLS.

create table if not exists screentime_config (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  platform text not null check (platform in ('ios', 'android')),
  token text not null unique,   -- webhook auth secret, generated server-side on creation

  last_synced_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists screentime_config_user_id_idx on screentime_config (user_id);
create index if not exists screentime_config_token_idx on screentime_config (token);

drop trigger if exists screentime_config_set_updated_at on screentime_config;
create trigger screentime_config_set_updated_at
  before update on screentime_config
  for each row execute function set_updated_at();

alter table screentime_config enable row level security;

-- Reads are scoped to the owning user (so they can copy their own webhook
-- URL/token in the UI). The ingestion route uses the service-role client,
-- which bypasses this entirely and looks the row up by token.
create policy "Users manage their own screentime config"
  on screentime_config for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
