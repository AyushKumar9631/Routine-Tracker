// LeetCode doesn't expose "did user X solve today's POTD" directly.
// Workaround: pair the public `activeDailyCodingChallengeQuestion` field
// (today's problem) with `recentAcSubmissionList(username, limit)` (a
// user's last N accepted submissions — public, no login required) and
// check whether today's slug shows up with a timestamp on today's UTC date.
// The date guard matters because LeetCode sometimes reuses old problems as
// POTD, so an old accepted submission for the same slug would otherwise
// false-positive.

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";

const QUERY = `
  query potdCheck($username: String!) {
    activeDailyCodingChallengeQuestion {
      date
      question {
        titleSlug
        title
      }
    }
    recentAcSubmissionList(username: $username, limit: 20) {
      titleSlug
      timestamp
    }
  }
`;

export interface LeetCodePotdResult {
  date: string; // POTD date, "YYYY-MM-DD", UTC
  titleSlug: string;
  title: string;
  solved: boolean;
}

export async function checkLeetCodePotd(username: string): Promise<LeetCodePotdResult> {
  const res = await fetch(LEETCODE_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { username } }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`LeetCode API error: ${res.status}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "LeetCode API error");
  }

  const potd = json.data?.activeDailyCodingChallengeQuestion;
  if (!potd?.question?.titleSlug) {
    throw new Error("LeetCode didn't return today's daily challenge");
  }

  const date: string = potd.date;
  const titleSlug: string = potd.question.titleSlug;
  const title: string = potd.question.title;

  const recent: Array<{ titleSlug: string; timestamp: string }> =
    json.data?.recentAcSubmissionList ?? [];

  const solved = recent.some((sub) => {
    if (sub.titleSlug !== titleSlug) return false;
    const subDateUtc = new Date(Number(sub.timestamp) * 1000).toISOString().slice(0, 10);
    return subDateUtc === date;
  });

  return { date, titleSlug, title, solved };
}
