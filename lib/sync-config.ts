// Background auto-poll interval for the LeetCode/GFG "Check now" buttons.
//
// NOTE: this hits an unofficial LeetCode GraphQL endpoint and scrapes a GFG
// profile page — neither is a public rate-limit-friendly API. Polling every
// 15s from every open tab is aggressive (4 req/min/tab against each
// service) and risks a temporary IP-level rate limit or block if you leave
// several tabs open. If you start seeing "Sync failed" messages that
// coincide with it working fine manually a few minutes later, that's likely
// why — raise this back up (30-60s) rather than debugging the sync code.
export const AUTO_SYNC_POLL_MS = 15_000;
