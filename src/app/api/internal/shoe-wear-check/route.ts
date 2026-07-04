import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushToAllDevices } from '@/lib/sendPushNotification'
import { getShoeWearAlerts } from '@/application/usecases/GetShoeWearAlerts'

export async function POST(req: NextRequest) {
  return handleInternalRoute('shoe-wear-check', req, async () => {
    const newAlerts = await getShoeWearAlerts()

    for (const alert of newAlerts) {
      await sendPushToAllDevices(
        `Shoe wear alert: ${alert.name}`,
        `${alert.totalKm} km - past its ${alert.alertThresholdKm} km alert threshold`
      )
    }

    return NextResponse.json({ newAlerts })
  })
}
