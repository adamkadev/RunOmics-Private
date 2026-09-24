import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushesToAllDevices } from '@/lib/sendPushNotification'
import { getShoeWearAlerts } from '@/application/usecases/GetShoeWearAlerts'

export async function POST(req: NextRequest) {
  return handleInternalRoute('shoe-wear-check', req, async () => {
    const { newAlerts, commit } = await getShoeWearAlerts()

    // Stored only once every alert went out, as in pr-check.
    await sendPushesToAllDevices(
      newAlerts.map((alert) => ({
        title: `Shoe wear alert: ${alert.name}`,
        body: `${alert.totalKm} km - past its ${alert.alertThresholdKm} km alert threshold`,
      }))
    )
    await commit()

    return NextResponse.json({ newAlerts })
  })
}
