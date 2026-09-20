-- Quick Stopwatch: an ad-hoc, un-scheduled study session. Not a routine
-- Activity — no period, no target, doesn't count toward "X of Y done". The
-- user gives it a label, it counts up (not down) until they hit Complete,
-- and it's saved into today's Completed list purely as a record.
-- Run this in the Supabase SQL editor after 017_study_timer.sql.

create table if not exists quick_stopwatches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  label text not null,
  status text not null default 'running' check (status in ('running', 'paused', 'completed')),

  -- Time banked from prior run segments (seconds). While running, the live
  -- total is accumulated_seconds + (now - running_since).
  accumulated_seconds numeric not null default 0,
  running_since timestamptz, -- set while status = 'running'; null otherwise
  completed_at timestamptz,
  -- The day it was completed (assigned on Complete) — null while active,
  -- since an open session isn't tied to a day yet. Used to list "today's"
  -- completed stopwatches without touching the routine due/done tally.
  period_key date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint running_requires_since check (status <> 'running' or running_since is not null),
  constraint completed_requires_fields check (
    status <> 'completed' or (completed_at is not null and period_key is not null)
  )
);

create index if not exists quick_stopwatches_user_status_idx on quick_stopwatches (user_id, status);
create index if not exists quick_stopwatches_period_key_idx on quick_stopwatches (user_id, period_key);

drop trigger if exists quick_stopwatches_set_updated_at on quick_stopwatches;
create trigger quick_stopwatches_set_updated_at
  before update on quick_stopwatches
  for each row execute function set_updated_at();

alter table quick_stopwatches enable row level security;

create policy "Users manage their own quick stopwatches"
  on quick_stopwatches for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
