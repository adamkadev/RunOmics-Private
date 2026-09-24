import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushesToAllDevices } from '@/lib/sendPushNotification'
import { getOverreachingAlerts } from '@/application/usecases/GetOverreachingAlerts'

export async function POST(req: NextRequest) {
  return handleInternalRoute('overreaching-check', req, async () => {
    const { newAlerts, commit } = await getOverreachingAlerts()

    // Stored only once the warning went out, so a failed push stays armed.
    await sendPushesToAllDevices(
      newAlerts.map((alert) => {
        const acwrPart = alert.acwr !== null ? `, ACWR ${alert.acwr}` : ''
        return {
          title: 'Overreaching risk detected',
          body: `Form (TSB) ${alert.tsb}${acwrPart} - high training risk, consider recovery.`,
        }
      })
    )
    await commit()

    return NextResponse.json({ newAlerts })
  })
}
