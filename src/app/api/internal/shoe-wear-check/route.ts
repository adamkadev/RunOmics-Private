import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushesToAllDevices } from '@/lib/sendPushNotification'
import { getShoeWearAlerts } from '@/application/usecases/GetShoeWearAlerts'
import { formatNumber } from '@/lib/formatters'
import { t } from '@/i18n'

export async function POST(req: NextRequest) {
  return handleInternalRoute('shoe-wear-check', req, async () => {
    const { newAlerts, commit } = await getShoeWearAlerts()

    // Stored only once every alert went out, as in pr-check.
    await sendPushesToAllDevices(
      newAlerts.map((alert) => ({
        title: t.notifications.shoeWear.title(alert.name),
        body: t.notifications.shoeWear.body(formatNumber(alert.totalKm, 0), formatNumber(alert.alertThresholdKm, 0)),
      }))
    )
    await commit()

    return NextResponse.json({ newAlerts })
  })
}
