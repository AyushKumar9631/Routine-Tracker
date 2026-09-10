-- Move the LeetCode POTD checker off GitHub Actions' best-effort, often-
-- delayed cron and onto Supabase's own scheduler, which lives in the same
-- database as everything else and isn't queued behind someone else's
-- runner backlog. This does NOT touch app/api/cron/leetcode-potd/route.ts
-- at all — pg_cron just becomes a second, more reliable thing calling the
-- exact same endpoint the same way GitHub Actions already does.
--
-- Run this in the Supabase SQL editor (or `supabase db push` if you use
-- the CLI). Leave the existing GitHub Actions workflow running alongside
-- this for now — task 3 in the plan is to compare the two for a bit and
-- then retire the workflow. Don't delete it yet.
--
-- NOTE: this file is committed to git. The value below matches what was
-- set as CRON_SECRET in Vercel at the time this was written — if you
-- rotate that secret later, update it here (or better, in the vault
-- directly via vault.update_secret) and redeploy Vercel to match.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('ee20a531ccd8896cacecf6bdb88153c78b697ae512cc6b0cc6dd9eecc82eb05f', 'cron_secret');
select vault.create_secret('https://routine-tracker-kohl.vercel.app', 'app_url');

select
  cron.schedule(
    'leetcode-potd-sync',
    '*/30 * * * *', -- same cadence as the GitHub Actions workflow, for now
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
--   -- Did pg_cron even try to run it, and did the SQL itself error?
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'leetcode-potd-sync')
--   order by start_time desc limit 10;
--
--   -- What did the actual HTTP call to Vercel come back with? (status
--   -- code, body). This is the one that tells you if the sync worked.
--   select created, status_code, content
--   from net._http_response
--   order by created desc limit 10;
--
-- To pause/remove this job later:
--   select cron.unschedule('leetcode-potd-sync');
