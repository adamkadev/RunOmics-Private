import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushToAllDevices } from '@/lib/sendPushNotification'
import { getStaleSyncAlert } from '@/application/usecases/GetStaleSyncAlert'
import { t } from '@/i18n'

export async function POST(req: NextRequest) {
  return handleInternalRoute('stale-sync-check', req, async () => {
    const { alert, commit } = await getStaleSyncAlert()

    if (alert) {
      await sendPushToAllDevices(t.notifications.staleSync.title, t.notifications.staleSync.body(alert.hoursSinceSync))
    }
    // After the push: one that fails throws past this, and the alert stays armed.
    await commit()

    return NextResponse.json({ alert })
  })
}
