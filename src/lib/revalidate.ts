/**
 * Shared ISR interval for statically-rendered pages whose content depends on
 * "what day/week/month is it" (streaks, weekly/monthly goals, race countdowns,
 * YTD stats, etc.).
 *
 * These pages are prerendered at build time and otherwise stay frozen until the
 * next deploy - which only happens once a day, whenever the Garmin sync workflow
 * commits new data (see .github/workflows/sync.yml). Without this, a day/week/
 * month boundary that passes between deploys leaves a page showing the previous
 * period's state (e.g. last week's streak dots, an already-run "next race") for
 * up to 24h.
 *
 * Next.js requires each page's `export const revalidate = ...` to be a literal
 * (importing this constant into that export is rejected at build time as an
 * "Invalid segment configuration export"), so this value can't be imported
 * directly - every page listed below must instead hardcode the same number and
 * is checked against it by revalidate.test.ts. Bump PAGES_USING_DATE_SENSITIVE_REVALIDATE
 * whenever a page's fetched data gains a "today"/"this week"/"this month" read.
 */
export const DATE_SENSITIVE_REVALIDATE_SECONDS = 3600

/** Every page.tsx that must export `revalidate = DATE_SENSITIVE_REVALIDATE_SECONDS` - see revalidate.test.ts. */
export const PAGES_USING_DATE_SENSITIVE_REVALIDATE = [
  'src/app/page.tsx',
  'src/app/analytics/page.tsx',
  'src/app/athlete/page.tsx',
  'src/app/goals/page.tsx',
  'src/app/profile/page.tsx',
  'src/app/records/page.tsx',
  'src/app/shoes/page.tsx',
]
