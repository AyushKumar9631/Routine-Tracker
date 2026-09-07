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
