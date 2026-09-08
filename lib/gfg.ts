// GFG doesn't publish a public API. The profile page also moved: it's now
// https://www.geeksforgeeks.org/profile/<username> (the old
// auth.geeksforgeeks.org/user/<username>/profile is stale). The page itself
// renders client-side, but the initial HTML still ships the data needed to
// hydrate it, embedded as an escaped JSON string inside a Next.js RSC
// stream literal: `self.__next_f.push([1,"...\"pod_solved_current_streak\":N...`
// (verified against a live profile page's raw source on 2026-09-09). The
// real field names are pod_solved_current_streak / pod_solved_longest_streak
// — not currentStreak/maxStreak, which never existed on this page and is
// why every check used to fail with "Couldn't find streak...".
//
// Quotes inside that embedded string are backslash-escaped (it's a JS
// string literal), so the regexes below tolerate an optional `\` before
// each `"` in case that escaping ever changes.

const PROFILE_URL = (username: string) =>
  `https://www.geeksforgeeks.org/profile/${encodeURIComponent(username)}`;

export interface GfgProfileResult {
  currentStreak: number;
  maxStreak: number | null;
}

export async function fetchGfgProfile(username: string): Promise<GfgProfileResult> {
  const res = await fetch(PROFILE_URL(username), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new Error(`GFG username "${username}" not found`);
  }
  if (!res.ok) {
    throw new Error(`GFG profile fetch failed: ${res.status}`);
  }

  const html = await res.text();

  const currentMatch = html.match(/\\?"pod_solved_current_streak\\?"\s*:\s*(\d+)/);
  if (currentMatch) {
    const longestMatch = html.match(/\\?"pod_solved_longest_streak\\?"\s*:\s*(\d+)/);
    return {
      currentStreak: Number(currentMatch[1]),
      maxStreak: longestMatch ? Number(longestMatch[1]) : null,
    };
  }

  // Fallback for older/alternate markup, kept in case GFG A/B tests a
  // server-rendered variant of this widget.
  const textMatch = html.match(/Current POTD Streak[\s\S]{0,80}?(\d+)\s*\/\s*(\d+)/i);
  if (textMatch) {
    return { currentStreak: Number(textMatch[1]), maxStreak: Number(textMatch[2]) };
  }

  throw new Error(`Couldn't find streak on ${username}'s GFG profile \u2014 markup may have changed`);
}
