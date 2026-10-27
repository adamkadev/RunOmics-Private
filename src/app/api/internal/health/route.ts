import { DAY_MS } from '@/lib/calendarDate'
import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getLastSyncedAt } from '@/application/usecases/GetSyncStatus'
import { hoursSinceSync, STALE_SYNC_HOURS } from '@/domain/sync/staleness'
import { integrationStatus } from '@/infrastructure/integrations'
import { dataVersion, loadData } from '@/application/usecases/LoadData'
import { lastAiPass } from '@/application/usecases/AiPassStatus'
import { liveFirestoreRulesHash } from '@/infrastructure/firestoreRulesHash'
import { withTimeout } from '@/infrastructure/withTimeout'

const FIRESTORE_TIMEOUT_MS = 3_000

/** The sync polls this probe for minutes: a slow or refused read answers null rather than hold it up. */
async function optional<T>(name: string, read: () => Promise<T>): Promise<T | null> {
  if (!integrationStatus().firebaseAdmin) return null
  try {
    return await withTimeout(read(), FIRESTORE_TIMEOUT_MS, null)
  } catch (error) {
    console.warn(`[internal:health] ${name} could not be read:`, error)
    return null
  }
}

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
    const now = Date.now()

    const lastSyncedAt = getLastSyncedAt()
    const hours = lastSyncedAt ? hoursSinceSync(lastSyncedAt, now) : null
    // A training break leaves the last run old and the sync healthy, so only the sync's own time decides.
    const stale = !(hours !== null && hours < STALE_SYNC_HOURS)
    const [ai, firestoreRulesHash] = await Promise.all([optional('ai', lastAiPass), optional('firestore rules', liveFirestoreRulesHash)])

    return NextResponse.json(
      {
        status: stale ? 'stale' : 'ok',
        hoursSinceSync: hours === null || Number.isNaN(hours) ? null : Math.round(hours),
        activityCount: activities.length,
        lastActivityDate: latest ? latest.date : null,
        daysSinceLastActivity: latest ? Math.floor((now - new Date(latest.date).getTime()) / DAY_MS) : null,
        lastSyncedAt,
        ...dataVersion(),
        version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
        integrations: integrationStatus(),
        ai,
        firestoreRulesHash,
      },
      { status: stale ? 503 : 200 }
    )
  }, undefined, { probe: true })
}
