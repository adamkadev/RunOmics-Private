export const PAGE_REVALIDATE_SECONDS = 3600

// Every page backed by data/. A sync commit redeploys Vercel and would
// rebuild them anyway, but ISR is what keeps them correct when a sync fails
// and the day rolls over regardless.
export const PAGE_PATHS_REQUIRING_REVALIDATE = [
  'src/app/page.tsx',
  'src/app/activities/page.tsx',
  'src/app/activities/[id]/page.tsx',
  'src/app/analytics/page.tsx',
  'src/app/athlete/page.tsx',
  'src/app/goals/page.tsx',
  'src/app/map/page.tsx',
  'src/app/plan/page.tsx',
  'src/app/profile/page.tsx',
  'src/app/records/page.tsx',
  'src/app/shoes/page.tsx',
  'src/app/shoes/[gearId]/page.tsx',
]
