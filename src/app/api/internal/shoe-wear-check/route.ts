import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedInternalRequest } from '@/lib/internalAuth'
import { sendPushToAllDevices } from '@/lib/sendPushNotification'
import { getShoeWearAlerts } from '@/application/usecases/GetShoeWearAlerts'

export async function POST(req: NextRequest) {
  if (!isAuthorizedInternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const newAlerts = await getShoeWearAlerts()

  for (const alert of newAlerts) {
    await sendPushToAllDevices(
      `Shoe wear alert: ${alert.name}`,
      `${alert.totalKm} km - past its ${alert.alertThresholdKm} km alert threshold`
    )
  }

  return NextResponse.json({ newAlerts })
}
