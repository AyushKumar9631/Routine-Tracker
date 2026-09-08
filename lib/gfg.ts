// GFG doesn't publish a public API. This scrapes the public profile page
// (https://auth.geeksforgeeks.org/user/<username>/profile) for the
// "Current POTD Streak" counter, the only public signal that exists for
// this. Note: that path is disallowed in GFG's robots.txt — this is the
// same approach every unofficial "GFG API" project uses, since there's no
// compliant alternative.
//
// The parsing below is best-effort: it wasn't possible to inspect GFG's
// live markup directly (also robots-blocked), so it tries a couple of
// patterns seen in equivalent open-source scrapers. If it throws
// "Couldn't find streak...", the page structure has likely changed and
// this needs a markup check + regex update.

const PROFILE_URL = (username: string) =>
  `https://auth.geeksforgeeks.org/user/${encodeURIComponent(username)}/profile`;

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

  if (!res.ok) {
    throw new Error(`GFG profile fetch failed: ${res.status}`);
  }

  const html = await res.text();

  // Try embedded page-state JSON first (most stable if GFG's frontend ships it).
  const jsonMatch = html.match(/"currentStreak"\s*:\s*"?(\d+)"?/);
  if (jsonMatch) {
    const maxMatch = html.match(/"maxStreak"\s*:\s*"?(\d+)"?/);
    return {
      currentStreak: Number(jsonMatch[1]),
      maxStreak: maxMatch ? Number(maxMatch[1]) : null,
    };
  }

  // Fallback: the rendered "NN /MM days" streak widget text.
  const textMatch = html.match(/Current POTD Streak[\s\S]{0,80}?(\d+)\s*\/\s*(\d+)/i);
  if (textMatch) {
    return { currentStreak: Number(textMatch[1]), maxStreak: Number(textMatch[2]) };
  }

  throw new Error(`Couldn't find streak on ${username}'s GFG profile \u2014 markup may have changed`);
}
