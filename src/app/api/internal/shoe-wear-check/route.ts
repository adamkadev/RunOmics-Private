import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushes } from '@/lib/sendPushNotification'
import { pushPaths } from '@/lib/pushLinks'
import { getShoeWearAlerts } from '@/application/usecases/GetShoeWearAlerts'
import { formatNumber } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export async function POST(req: NextRequest) {
  return handleInternalRoute('shoe-wear-check', req, async () => {
    await loadData()
    const { newAlerts, commit } = await getShoeWearAlerts()

    // Stored only once every alert went out, as in pr-check.
    await sendPushes(
      'shoes',
      newAlerts.map((alert) => ({
        title: t.notifications.shoeWear.title(alert.name),
        body: t.notifications.shoeWear.body(formatNumber(alert.totalKm, 0), formatNumber(alert.alertThresholdKm, 0)),
        link: pushPaths.shoe(alert.gearId),
        tag: `shoe-wear:${alert.gearId}`,
      }))
    )
    await commit()

    return NextResponse.json({ newAlerts })
  })
}
