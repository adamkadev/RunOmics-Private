import { DAY_MS } from '@/lib/calendarDate'
import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { integrationStatus } from '@/infrastructure/integrations'
import { dataVersion, loadData } from '@/application/usecases/LoadData'

const STALE_AFTER_DAYS = 7

export async function GET(req: NextRequest) {
  return handleInternalRoute('health', req, async () => {
    try {
      await loadData()
    } catch (error) {
      // Still answers, so the sync can name the commit it refused.
      console.error('[internal:health]', error)
      return NextResponse.json({ status: 'unloaded', ...dataVersion() }, { status: 503 })
    }
    const activities = getAllActivities()
    const latest = activities[0] ?? null

    const lastActivityDate = latest ? latest.date : null
    const daysSinceLastActivity = latest
      ? Math.floor((Date.now() - new Date(latest.date).getTime()) / DAY_MS)
      : null

    return NextResponse.json({
      status: daysSinceLastActivity !== null && daysSinceLastActivity <= STALE_AFTER_DAYS ? 'ok' : 'stale',
      activityCount: activities.length,
      lastActivityDate,
      daysSinceLastActivity,
      lastSyncedAt: getLastSyncedAt(),
      ...dataVersion(),
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
      integrations: integrationStatus(),
    })
  })
}
