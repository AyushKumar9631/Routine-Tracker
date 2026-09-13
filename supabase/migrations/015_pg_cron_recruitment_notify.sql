-- pg_cron schedule for the recruitment deadline-notify route. Same SQL-gate
-- shape as 010_leetcode_notify_sql_gate.sql / 012_pg_cron_gfg_notify.sql:
-- net.http_get only fires when at least one round is actually due, instead
-- of hitting Vercel unconditionally every tick.
--
-- Cadence is 30 minutes, not the 5 minutes the LeetCode/GFG jobs use --
-- this is the user's explicit choice (plan doc section 1.5), not an
-- oversight: those two watch a single tight deadline (midnight), while
-- these reminders have hour-wide windows (>=19:00 the evening before,
-- >=09:00 the morning of), so a 30-minute poll can't meaningfully miss one.
-- Do not "optimize" this to 5 minutes.
--
-- The date/time trigger mirrors lib/recruitment-notify.ts's
-- isEveningReminderDue/isMorningReminderDue exactly (tomorrow/>=19:00,
-- today/>=09:00, Asia/Kolkata) -- if that TS logic ever changes, update this
-- WHERE clause to match. Only the *current* round (highest round_no) of
-- each *active* drive is ever a candidate, per plan section 1.5 ("For the
-- current round of every active drive").
--
-- Run in the Supabase SQL editor (or `supabase db push`). Reuses the
-- `app_url` / `cron_secret` vault entries from 005 -- no new secrets needed.

select cron.schedule(
  'recruitment-notify-check',
  '*/30 * * * *',
  $cron$
  do $body$
  declare
    due_ids text;
  begin
    select string_agg(r.id::text, ',')
      into due_ids
    from recruitment_rounds r
    join recruitment_details d on d.activity_id = r.activity_id
    where d.status = 'active'
      -- matches the recruitment_rounds_due_idx partial index from 014
      and r.result = 'awaiting'
      and (r.notified_evening_sent = false or r.notified_morning_sent = false)
      and r.round_no = (
        select max(r2.round_no) from recruitment_rounds r2 where r2.activity_id = r.activity_id
      )
      and (
        (
          not r.notified_evening_sent
          and r.test_date = ((now() at time zone 'Asia/Kolkata')::date + 1)
          and (now() at time zone 'Asia/Kolkata')::time >= '19:00:00'::time
        )
        or (
          not r.notified_morning_sent
          and r.test_date = (now() at time zone 'Asia/Kolkata')::date
          and (now() at time zone 'Asia/Kolkata')::time >= '09:00:00'::time
        )
      );

    if due_ids is not null then
      perform net.http_get(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
          || '/api/cron/recruitment-notify?round_ids=' || due_ids,
        headers := jsonb_build_object(
          'Authorization',
          'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
        ),
        timeout_milliseconds := 55000
      );
    end if;
  end;
  $body$;
  $cron$
);

-- Useful queries while verifying this:
--
--   select jobid, jobname, schedule, active from cron.job
--   where jobname = 'recruitment-notify-check';
--
--   -- Did pg_cron even try to run it, and did the SQL itself error?
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'recruitment-notify-check')
--   order by start_time desc limit 10;
--   -- a run where nothing was due completes with no net.http_get call at
--   -- all, so it won't show up in net._http_response for that tick.
--
--   -- What did the actual HTTP call to Vercel come back with?
--   select created, status_code, content
--   from net._http_response
--   order by created desc limit 10;
--
-- To fake a due round for testing (evening reminder, tomorrow Kolkata + already
-- past 19:00 today):
--   update recruitment_rounds set test_date = ((now() at time zone 'Asia/Kolkata')::date + 1)
--   where id = '<round id>';
--
-- To pause/remove this job later:
--   select cron.unschedule('recruitment-notify-check');
