-- pg_cron schedule for the GFG deadline-notify route. Same SQL-gate shape
-- as 010_leetcode_notify_sql_gate.sql: net.http_get only fires when at
-- least one gfg_potd activity is actually due, instead of hitting Vercel
-- unconditionally every 5 min.
--
-- Threshold default (22:00 Asia/Kolkata) mirrors todaysNotifyThreshold()'s
-- fallback in lib/deadlines.ts, same as the LeetCode job.
--
-- Run in the Supabase SQL editor (or `supabase db push`). Reuses the
-- `app_url` / `cron_secret` vault entries from 005 — no new secrets needed.

select cron.schedule(
  'gfg-notify-check',
  '*/5 * * * *',
  $cron$
  do $body$
  declare
    due_ids text;
  begin
    select string_agg(a.id::text, ',')
      into due_ids
    from activities a
    join gfg_potd_config c on c.activity_id = a.id
    where a.automation_type = 'gfg_potd'
      and a.is_active
      and c.last_notified_on is distinct from (now() at time zone 'Asia/Kolkata')::date
      and (now() at time zone 'Asia/Kolkata')::time >= coalesce(c.preferred_complete_by, '22:00:00'::time)
      and not exists (
        select 1 from completions co
        where co.activity_id = a.id
          and co.period_key = (now() at time zone 'Asia/Kolkata')::date
          and co.completed
      );

    if due_ids is not null then
      perform net.http_get(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
          || '/api/cron/gfg-notify?activity_ids=' || due_ids,
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

-- Verify:
--   select jobid, jobname, schedule, active from cron.job
--   where jobname in ('gfg-notify-check', 'leetcode-notify-check');
--
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'gfg-notify-check')
--   order by start_time desc limit 10;
--
-- To pause/remove this job later:
--   select cron.unschedule('gfg-notify-check');
