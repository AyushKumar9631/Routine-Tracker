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

## 6. Recruitment tracker (drives, AI research, chat)

1. SQL Editor → run, in order:
   - `supabase/migrations/014_recruitment_schema.sql` (adds `activities.kind`,
     `recruitment_details`, `recruitment_rounds`, `recruitment_ai_insights`,
     `recruitment_chat_messages`, RLS included).
   - `supabase/migrations/015_pg_cron_recruitment_notify.sql` (schedules the
     30-minute reminder check). Reuses the `app_url` / `cron_secret` vault
     entries already created in step 5's migration 005 — no new secrets.
2. Sign up for a free Groq account at [console.groq.com](https://console.groq.com)
   (no credit card needed) and create an API key.
3. Add to `.env.local` / Vercel env vars:
   - `GROQ_API_KEY` — the key from step 2. Server-only — never expose it with
     a `NEXT_PUBLIC_` prefix.
   - `CRON_SECRET` is reused from step 5 (same value) — the AI research route
     is gated with it too, so nothing new to add there if you already did
     step 5.
4. In the app: **+ Add activity** → **Recruitment Drive** tile → enter
   company name, role, and round 1's type (OA/Communication/Technical/HR/
   Other); the test date is optional and can be filled in later from Today.
5. Reminder pushes reuse the same ntfy topic set up in **Notification
   settings** as every other automation — nothing recruitment-specific to
   configure there.

How it works:

- **Creating a drive** (or logging "Passed" → "Another round") fires a
  fire-and-forget request to `app/api/ai/recruitment-enrich` — not awaited by
  the create/progress action, so it never blocks the UI. That route makes two
  chained calls to Groq's `openai/gpt-oss-120b` model (with its native
  `browser_search` tool, so it can look up live info): a one-time **company
  overview** per drive, and a **round prep** (expected topics/duration/
  format/question count) for each round. Each starts as a `pending` row in
  `recruitment_ai_insights` and flips to `ready` or `failed` when the call
  returns, so the detail page can show a "Researching…" state and fill in on
  its own (or offer a retry on failure) instead of blocking anything.
- **Chat** (`app/api/ai/recruitment-chat`) uses the same model with no
  `browser_search` — it's grounded in the drive's stored context (company/
  role/current round/whatever research has finished) plus the running
  transcript, not fresh lookups on every message. Every exchange is saved to
  `recruitment_chat_messages`, but only after a reply actually comes back —
  a failed call leaves nothing half-saved.
- **Reminders**: `supabase/migrations/015...sql` schedules a pg_cron job every
  30 minutes (a deliberately slower cadence than the LeetCode/GFG 5-minute
  jobs, since these windows are hour-wide, not minute-wide). It SQL-gates the
  check so it only calls out to `app/api/cron/recruitment-notify` when some
  round is actually due — an evening-before push once `test_date` is tomorrow
  and it's ≥19:00 Kolkata time, or a morning-of push once `test_date` is today
  and it's ≥09:00 — each a one-shot per round, not daily-repeating.

## 7. Study Timer

1. SQL Editor → run `supabase/migrations/017_study_timer.sql` (adds
   `study_timer_config`, RLS included). No new env vars — it reuses the same
   `notification_settings`/ntfy topic as every other automation.
2. In the app: **+ Add activity** → **Study Timer** tile → name it and set a
   daily goal in minutes (e.g. 120 for "2 hrs DBMS study").
3. From Today (or the activity's own page), hit **Start** — a live countdown
   runs from your goal down to zero, then keeps counting in the negative
   (overtime) until you hit **Stop**. The running session is stored server-side
   (`study_timer_config.running_since`), so it survives a page reload or
   closing the tab and coming back.
4. The moment the countdown crosses zero: a short chime plays, a browser
   notification pops up (first click asks for permission), and — if you've
   connected a topic in **Notification settings** — a push goes to your
   phone too. All three are controlled by the single "Notify when the goal
   is reached" toggle on the activity.
5. On Today, Study Timer shares its card slot with Screen Time (if you have
   both) — swipe or use the arrows/dots to switch between them; both stay
   "live" underneath even when not the one showing.
6. The activity's detail page shows the same Start/Stop card plus a
   four-color heatmap (no study / under 50% / 50–90% / 90%+ of that day's
   goal) and a 30-day log of minutes studied vs. goal.

How it works: minutes studied land in `completions.value` exactly like
Screen Time — Stop folds the just-finished session's elapsed time into
whatever was already logged for that day. There's no cron job; the goal-
reached notification fires client-side off the live countdown itself
(`components/study-timer-card.tsx`), not off a server poll.

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
- **study_timer_config** — one row per Study Timer activity: `running_since`
  (non-null while a session is live), `session_period_key` (the day the live
  session's minutes belong to), and the notify toggle/custom phone message.
