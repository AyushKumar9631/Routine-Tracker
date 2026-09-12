-- Per-user ntfy.sh topic for push notifications (the LeetCode deadline
-- nudge today, any future notification type later). Replaces the single
-- shared NTFY_TOPIC_URL env var: each user connects their own topic from
-- the nav bar, so a new user doesn't need a Vercel env var change to get
-- notifications working. NTFY_TOPIC_URL can be removed from Vercel once
-- this ships — nothing reads it anymore after this migration's code lands.

create table if not exists notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ntfy_topic text, -- bare topic name, e.g. "routine-tracker-9dd3f8493318a55365216d2f"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notification_settings enable row level security;

drop policy if exists "Users manage their own notification settings" on notification_settings;
create policy "Users manage their own notification settings"
  on notification_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- set_updated_at() already exists (defined in schema.sql for `activities`).
drop trigger if exists notification_settings_set_updated_at on notification_settings;
create trigger notification_settings_set_updated_at
  before update on notification_settings
  for each row execute function set_updated_at();
