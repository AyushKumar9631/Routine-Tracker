-- Study Timer automation: a user-started/stopped countdown from a daily
-- study-minutes goal down to zero and into negative (overtime) until
-- stopped. Unlike LeetCode/GFG/Screen Time, there's no external source to
-- poll or push — the "automation" is just persisting the live session
-- (`running_since`) so it survives a page reload/navigation, and the
-- accumulated minutes land in `completions.value` exactly like Screen Time.
-- Run this in the Supabase SQL editor after 016_recruitment_ai_progress.sql.

create table if not exists study_timer_config (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Set the moment Start is pressed, cleared the moment Stop is pressed. A
  -- non-null value here IS "the timer is currently running" — there's no
  -- separate boolean to drift out of sync with it.
  running_since timestamptz,
  -- Which day's completions row the current session's elapsed time should
  -- add to on Stop — fixed at Start time so a session that happens to cross
  -- midnight still logs entirely to the day it started, rather than
  -- splitting across two rows.
  session_period_key date,

  notify_on_goal boolean not null default true,
  notification_template text, -- custom phone-push message; null = use the default

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint session_period_key_requires_running check (
    running_since is null or session_period_key is not null
  )
);

create index if not exists study_timer_config_user_id_idx on study_timer_config (user_id);

drop trigger if exists study_timer_config_set_updated_at on study_timer_config;
create trigger study_timer_config_set_updated_at
  before update on study_timer_config
  for each row execute function set_updated_at();

alter table study_timer_config enable row level security;

create policy "Users manage their own study timer config"
  on study_timer_config for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
