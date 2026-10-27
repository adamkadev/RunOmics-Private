import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushes } from '@/lib/sendPushNotification'
import { pushPaths } from '@/lib/pushLinks'
import { getOverreachingAlerts } from '@/application/usecases/GetOverreachingAlerts'
import { formatNumber } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export async function POST(req: NextRequest) {
  return handleInternalRoute('overreaching-check', req, async () => {
    await loadData()
    const { newAlerts, commit } = await getOverreachingAlerts()

    // Stored only once the warning went out, so a failed push stays armed.
    await sendPushes(
      'training',
      newAlerts.map((alert) => ({
        title: t.notifications.overreaching.title,
        body: t.notifications.overreaching.body(formatNumber(alert.tsb), alert.acwr !== null ? formatNumber(alert.acwr, 2) : null),
        link: pushPaths.analytics,
        tag: 'overreaching',
      }))
    )
    await commit()

    return NextResponse.json({ newAlerts })
  })
}
