-- pg_cron schedule for the LeetCode deadline-notify route, plus dialing
-- the existing leetcode-potd-sync job back to a gentler cadence now that
-- a second 5-minute job is being added alongside it.
--
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- Reuses the `app_url` / `cron_secret` vault entries created in
-- 005_pg_cron_leetcode.sql — no new secrets needed.
--
-- Note: 005's committed SQL scheduled leetcode-potd-sync at */30 * * * *,
-- though this plan's notes referred to it as a 1-minute stress-test
-- cadence — whichever it currently is, the cron.schedule() call below is
-- an idempotent upsert by job name, so it sets the cadence to */5
-- regardless of what it was before.

select
  cron.schedule(
    'leetcode-notify-check',
    '*/5 * * * *',
    $$
    select net.http_get(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
        || '/api/cron/leetcode-notify',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      timeout_milliseconds := 55000
    );
    $$
  );

-- Dial the existing sync job back down. Same job name + same call body as
-- 005 — cron.schedule() with an existing job name just updates it in
-- place, it doesn't create a duplicate.
select
  cron.schedule(
    'leetcode-potd-sync',
    '*/5 * * * *',
    $$
    select net.http_get(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
        || '/api/cron/leetcode-potd',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      timeout_milliseconds := 55000
    );
    $$
  );

-- Useful queries while verifying this:
--
--   -- Confirm both jobs and their current schedules:
--   select jobid, jobname, schedule, active from cron.job
--   where jobname in ('leetcode-notify-check', 'leetcode-potd-sync');
--
--   -- Did pg_cron even try to run the new job, and did the SQL itself error?
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'leetcode-notify-check')
--   order by start_time desc limit 10;
--
--   -- What did the actual HTTP call to Vercel come back with?
--   select created, status_code, content
--   from net._http_response
--   order by created desc limit 10;
--
-- To pause/remove the new job later:
--   select cron.unschedule('leetcode-notify-check');
