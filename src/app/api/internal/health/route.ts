import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'

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
      lastSyncedAt: getLastSyncedAt(),
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    })
  })
}
