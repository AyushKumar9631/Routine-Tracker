-- Routine Tracker schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

create type period_type as enum ('daily', 'weekly', 'biweekly', 'monthly');
create type completion_type as enum ('boolean', 'count');

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  icon text default '\u2713',
  color text default '#3F6B47',

  period period_type not null default 'daily',
  -- weekly / biweekly: 0 = Sunday ... 6 = Saturday
  schedule_day_of_week smallint check (schedule_day_of_week between 0 and 6),
  -- monthly: 1-31
  schedule_day_of_month smallint check (schedule_day_of_month between 1 and 31),
  -- biweekly needs a reference date to know which weeks are "on"
  anchor_date date,

  completion_type completion_type not null default 'boolean',
  target_value numeric,       -- threshold, required when completion_type = 'count'
  unit_label text,            -- e.g. "commits", "problems"

  -- reserved for future automated activities (git commits, LeetCode, etc.)
  -- left null/false until the automation feature is built
  is_automated boolean not null default false,
  automation_type text,
  automation_config jsonb,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint weekly_requires_day check (
    period not in ('weekly', 'biweekly') or schedule_day_of_week is not null
  ),
  constraint monthly_requires_day check (
    period <> 'monthly' or schedule_day_of_month is not null
  ),
  constraint biweekly_requires_anchor check (
    period <> 'biweekly' or anchor_date is not null
  ),
  constraint count_requires_target check (
    completion_type <> 'count' or target_value is not null
  )
);

create table if not exists completions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- the date identifying which period instance this belongs to
  -- (the day itself for daily; the scheduled date for weekly/biweekly/monthly)
  period_key date not null,

  value numeric,              -- actual count, null for boolean activities
  completed boolean not null default false,
  note text,

  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (activity_id, period_key)
);

create index if not exists activities_user_id_idx on activities (user_id);
create index if not exists completions_user_id_idx on completions (user_id);
create index if not exists completions_activity_id_idx on completions (activity_id, period_key desc);

-- keep updated_at fresh
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists activities_set_updated_at on activities;
create trigger activities_set_updated_at
  before update on activities
  for each row execute function set_updated_at();

-- Row Level Security: every user only sees their own rows
alter table activities enable row level security;
alter table completions enable row level security;

create policy "Users manage their own activities"
  on activities for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own completions"
  on completions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
