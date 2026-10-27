import { NextResponse } from 'next/server'
import { scheduledRoute } from '@/lib/internalRoute'
import { sendPush } from '@/lib/sendPushNotification'
import { pushPaths } from '@/lib/pushLinks'
import { getStaleSyncAlert } from '@/application/usecases/GetStaleSyncAlert'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export const { GET, POST } = scheduledRoute('stale-sync-check', async () => {
  await loadData()
  const { alert, commit } = await getStaleSyncAlert()

  if (alert) {
    await sendPush('always', {
      title: t.notifications.staleSync.title,
      body: t.notifications.staleSync.body(alert.hoursSinceSync),
      link: pushPaths.settings,
      tag: 'stale-sync',
    })
  }
  // After the push: one that fails throws past this, and the alert stays armed.
  await commit()

  return NextResponse.json(alert ? { sent: true, alert } : { sent: false, alert })
})
