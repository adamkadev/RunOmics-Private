import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushToAllDevices } from '@/lib/sendPushNotification'
import { getOverreachingAlerts } from '@/application/usecases/GetOverreachingAlerts'

export async function POST(req: NextRequest) {
  return handleInternalRoute('overreaching-check', req, async () => {
    const newAlerts = await getOverreachingAlerts()

    for (const alert of newAlerts) {
      const acwrPart = alert.acwr !== null ? `, ACWR ${alert.acwr}` : ''
      await sendPushToAllDevices(
        'Overreaching risk detected',
        `Form (TSB) ${alert.tsb}${acwrPart} - high training risk, consider recovery.`
      )
    }

    return NextResponse.json({ newAlerts })
  })
}
