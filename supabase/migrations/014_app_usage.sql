-- App-wise screen time tracking.
-- Run this migration after 013_screentime_notify_columns.sql.
-- Stores individual app open/close events and calculated usage durations.

create table if not exists app_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  app_name text not null,
  app_bundle_id text,  -- optional iOS bundle identifier for more precise tracking

  opened_at timestamptz not null,
  closed_at timestamptz,
  duration_minutes integer,  -- calculated when closed_at is set

  date_key text not null,  -- YYYY-MM-DD format, for efficient daily queries

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_usage_user_id_date_key_idx on app_usage (user_id, date_key);
create index if not exists app_usage_user_id_opened_at_idx on app_usage (user_id, opened_at desc);
create index if not exists app_usage_date_key_app_name_idx on app_usage (date_key, app_name);

drop trigger if exists app_usage_set_updated_at on app_usage;
create trigger app_usage_set_updated_at
  before update on app_usage
  for each row execute function set_updated_at();

alter table app_usage enable row level security;

-- Users can only see and modify their own app usage data
create policy "Users manage their own app usage"
  on app_usage for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
