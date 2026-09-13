-- Recruitment Tracker schema.
-- Run this in the Supabase SQL editor (or `supabase db push`) after schema.sql
-- and all prior migrations.
--
-- This adds a *second kind* of activity alongside the existing period/completion
-- driven ones: a recruitment drive (one company + one role) that moves through one
-- or more interview rounds until it's rejected or turns into an offer. It does not
-- use `completions` at all -- there's no period to mark done/not-done, only a
-- round-by-round state machine (see recruitment_rounds.result below).
--
-- `activities.kind` defaults every existing row to 'routine', so nothing already
-- in the table is affected. A recruitment-kind activities row keeps `period` and
-- `completion_type` at their existing defaults ('daily' / 'boolean') purely to
-- satisfy the NOT NULL constraints already on those columns -- the app must never
-- read them for kind = 'recruitment'.

alter table activities
  add column if not exists kind text not null default 'routine'
  check (kind in ('routine', 'recruitment'));

-- One row per recruitment drive (1:1 with an activities row of kind='recruitment').
create table if not exists recruitment_details (
  activity_id uuid primary key references activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  company_name text not null,
  company_url text,
  role text not null,

  status text not null default 'active' check (status in ('active', 'done')),
  final_outcome text check (final_outcome in ('offer', 'rejected', 'withdrawn')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recruitment_details_user_id_idx on recruitment_details (user_id);

-- One row per interview round within a drive. round_type/result vocab is fixed
-- here in SQL (not left as free text) so the state machine can't drift between
-- the app and the database -- see the plan doc, section 1.4, for the exact
-- transitions each result value is allowed to trigger.
create table if not exists recruitment_rounds (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  round_no smallint not null,
  round_type text not null check (round_type in ('oa', 'communication', 'technical', 'hr', 'other')),

  test_date date,  -- optional; null = "no date yet, ask on the Today page"

  result text not null default 'awaiting'
    check (result in ('awaiting', 'confident', 'not_sure', 'rejected', 'passed')),

  -- one-shot reminder flags, never reset -- see plan doc section 1.5
  notified_evening_sent boolean not null default false,
  notified_morning_sent boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (activity_id, round_no)
);

create index if not exists recruitment_rounds_activity_id_idx on recruitment_rounds (activity_id);
create index if not exists recruitment_rounds_user_id_idx on recruitment_rounds (user_id);

-- Reminder cron (a later migration/task) will scan for rounds that are due and
-- haven't fired yet -- this partial index keeps that scan cheap without needing
-- to touch every round every 30 minutes.
create index if not exists recruitment_rounds_due_idx
  on recruitment_rounds (test_date)
  where result = 'awaiting' and (notified_evening_sent = false or notified_morning_sent = false);

-- AI research output. round_id null = company-level (AI pass 1, "company
-- overview"); non-null = round-specific prep (AI pass 2, "round prep"), one row
-- per round it was run for. See plan doc section 1.6 -- these are unrelated to
-- recruitment_rounds' own round_no/result and must never be confused with them.
create table if not exists recruitment_ai_insights (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  round_id uuid references recruitment_rounds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  kind text not null check (kind in ('company_overview', 'round_prep')),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  content jsonb,
  error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recruitment_ai_insights_activity_id_idx on recruitment_ai_insights (activity_id);
create index if not exists recruitment_ai_insights_user_id_idx on recruitment_ai_insights (user_id);

-- Chat transcript for the detail-page assistant, one row per message, oldest first.
create table if not exists recruitment_chat_messages (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  role text not null check (role in ('user', 'assistant')),
  content text not null,

  created_at timestamptz not null default now()
);

create index if not exists recruitment_chat_messages_activity_id_idx on recruitment_chat_messages (activity_id, created_at);
create index if not exists recruitment_chat_messages_user_id_idx on recruitment_chat_messages (user_id);

-- keep updated_at fresh, reusing the trigger function schema.sql already defines
drop trigger if exists recruitment_details_set_updated_at on recruitment_details;
create trigger recruitment_details_set_updated_at
  before update on recruitment_details
  for each row execute function set_updated_at();

drop trigger if exists recruitment_rounds_set_updated_at on recruitment_rounds;
create trigger recruitment_rounds_set_updated_at
  before update on recruitment_rounds
  for each row execute function set_updated_at();

drop trigger if exists recruitment_ai_insights_set_updated_at on recruitment_ai_insights;
create trigger recruitment_ai_insights_set_updated_at
  before update on recruitment_ai_insights
  for each row execute function set_updated_at();

-- Row Level Security -- same shape as every other table in this project.
alter table recruitment_details enable row level security;
create policy "Users manage their own recruitment details"
  on recruitment_details for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table recruitment_rounds enable row level security;
create policy "Users manage their own recruitment rounds"
  on recruitment_rounds for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table recruitment_ai_insights enable row level security;
create policy "Users manage their own recruitment ai insights"
  on recruitment_ai_insights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table recruitment_chat_messages enable row level security;
create policy "Users manage their own recruitment chat messages"
  on recruitment_chat_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
