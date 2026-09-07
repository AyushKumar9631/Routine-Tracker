# Routine Tracker

Personal routine/habit tracker. This pass ships the UI + database only:
generic activities (add/edit/delete/pause), daily quick-logging, and
basic analytics (streak, completion rate, history heatmap). No automated
integrations (git commits, LeetCode, etc.) yet — those plug into the same
`completions` table later.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Postgres + Auth).

## 1. Create the Supabase project

1. New project at supabase.com.
2. SQL Editor → paste and run `supabase/schema.sql`. Creates `activities`
   and `completions` tables with RLS (each user only sees their own rows).
3. Authentication → Providers → make sure **Email** is enabled. This app
   uses passwordless magic-link sign-in, no extra provider setup needed.
4. Authentication → URL Configuration → add your local (`http://localhost:3000`)
   and production (Vercel) URLs to **Redirect URLs**.
5. Project Settings → API → copy the **Project URL** and **anon public** key.

## 2. Configure env vars

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 3. Run locally

```bash
npm install
npm run dev
```

Visit `localhost:3000`, sign in with your email (magic link), start adding
activities.

## 4. Deploy

Push to GitHub, import into Vercel, add the same two env vars in the Vercel
project settings, deploy. Add the resulting `*.vercel.app` URL to Supabase's
redirect URLs list (step 1.4) or magic links will bounce back to localhost.

## 5. LeetCode Daily Challenge automation

1. SQL Editor → run `supabase/migrations/002_leetcode_potd.sql` (adds
   `leetcode_potd_config`, RLS included).
2. Project Settings → API → copy the **service_role** key (server-only,
   bypasses RLS — never expose to the browser).
3. Add to `.env.local` / Vercel env vars:
   - `SUPABASE_SERVICE_ROLE_KEY` — the key from step 2.
   - `CRON_SECRET` — any random string, e.g. `openssl rand -hex 32`.
4. In the app: **+ Add activity** → Automation → **LeetCode Daily
   Challenge** → enter your LeetCode username (public, no password). It
   forces daily / done-not-done, since that's what POTD is.
5. Scheduling the check — pick one:
   - **Vercel Cron** (`vercel.json`, already wired to `30 22 * * *` UTC):
     free on Hobby, but Hobby caps built-in cron at once/day, so a solve
     right before that run could be missed until the next day's run.
   - **GitHub Actions** (`.github/workflows/leetcode-potd-sync.yml`):
     polls every 30 min, still free. Add repo secrets `APP_URL` (your
     `https://*.vercel.app` URL) and `CRON_SECRET` (same value as step 3).
     Recommended if you want same-day detection reliably.
   - Either way, there's also a **Check now** button on the activity (Today
     view and its detail page) for an on-demand check right after solving.

How it works: LeetCode has no "did user X finish today's POTD" field, so
this pairs two public GraphQL fields — `activeDailyCodingChallengeQuestion`
(today's problem) and `recentAcSubmissionList(username, limit)` (a user's
last N accepted submissions, public, no login) — and checks whether today's
problem slug shows up in recent ACs with a timestamp on today's UTC date.
The date check guards against LeetCode reusing an old problem as POTD,
where an old accepted submission for that slug would otherwise false-match.

## Data model

- **activities** — name, icon/color, `period` (daily/weekly/biweekly/monthly)
  with the day it's due, `completion_type` (`boolean` or `count` +
  `target_value`), active flag. `is_automated` / `automation_type` /
  `automation_config` columns exist but are unused for now — reserved for
  wiring up automated sources later.
- **completions** — one row per due period per activity (`period_key` is the
  date of that instance), with `completed`, `value`, and a timestamp. This is
  the table any future automation (a cron job, a webhook, an edge function)
  would write into instead of you clicking a checkbox.
