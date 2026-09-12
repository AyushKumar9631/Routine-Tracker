-- Push the cheap "is this even due?" gate into pg_cron itself, so
-- net.http_get only fires when at least one activity actually needs a
-- check — instead of hitting Vercel unconditionally every 5 min and
-- letting the route decide. Also retires leetcode-potd-sync (pg_cron
-- side): notify-check already does its own LeetCode check + completion
-- upsert when due, so the separate always-on sync isn't needed for
-- correctness. Real-time "solved" status outside the notify window is a
-- known trade-off — see chat notes / leetcode-deadline-notification-plan.md.
--
-- Threshold default (22:00 Asia/Kolkata) mirrors todaysNotifyThreshold()'s
-- fallback in lib/deadlines.ts (deadline-2h, and deadline is always next
-- Kolkata midnight, so the fallback is always 22:00 local, no per-day math
-- needed here).
--
-- Run in the Supabase SQL editor (or `supabase db push`).

do $$
begin
  if exists (select 1 from cron.job where jobname = 'leetcode-potd-sync') then
    perform cron.unschedule('leetcode-potd-sync');
  end if;
end;
$$;

select cron.schedule(
  'leetcode-notify-check',
  '*/5 * * * *',
  $cron$
  do $body$
  declare
    due_ids text;
  begin
    select string_agg(a.id::text, ',')
      into due_ids
    from activities a
    join leetcode_potd_config c on c.activity_id = a.id
    where a.automation_type = 'leetcode_potd'
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
          || '/api/cron/leetcode-notify?activity_ids=' || due_ids,
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
--   where jobname in ('leetcode-potd-sync', 'leetcode-notify-check');
--   -- leetcode-potd-sync should be gone entirely.
--
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'leetcode-notify-check')
--   order by start_time desc limit 10;
--   -- a run where nothing was due completes with no net.http_get call at
--   -- all, so it won't show up in net._http_response for that tick.
