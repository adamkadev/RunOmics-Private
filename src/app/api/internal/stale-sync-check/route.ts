import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushToAllDevices } from '@/lib/sendPushNotification'
import { getStaleSyncAlert } from '@/application/usecases/GetStaleSyncAlert'

export async function POST(req: NextRequest) {
  return handleInternalRoute('stale-sync-check', req, async () => {
    const { alert, commit } = await getStaleSyncAlert()

    if (alert) {
      await sendPushToAllDevices(
        'No data synced in a while',
        `Your last Garmin sync was ${alert.hoursSinceSync}h ago - check that sync is still running.`
      )
    }
    // After the push: one that fails throws past this, and the alert stays armed.
    await commit()

    return NextResponse.json({ alert })
  })
}
