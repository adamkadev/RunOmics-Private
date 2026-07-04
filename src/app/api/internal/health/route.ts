import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'

// Sync freshness probe: the Garmin pipeline runs on a GitHub Actions cron,
// and until now the only failure signal was the Actions run history. This
// lets the workflow (or any monitor) ask the deployed app how stale its
// data actually is.
const STALE_AFTER_DAYS = 7

export async function GET(req: NextRequest) {
  return handleInternalRoute('health', req, async () => {
    const activities = getAllActivities()
    const latest = activities[0] ?? null

    const lastActivityDate = latest ? latest.date : null
    const daysSinceLastActivity = latest
      ? Math.floor((Date.now() - new Date(latest.date).getTime()) / 86_400_000)
      : null

    return NextResponse.json({
      status: daysSinceLastActivity !== null && daysSinceLastActivity <= STALE_AFTER_DAYS ? 'ok' : 'stale',
      activityCount: activities.length,
      lastActivityDate,
      daysSinceLastActivity,
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    })
  })
}
