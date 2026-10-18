import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushToAllDevices } from '@/lib/sendPushNotification'
import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { appTodayIso } from '@/lib/calendarDate'
import { formatNumber } from '@/lib/formatters'
import { t } from '@/i18n'

export async function POST(req: NextRequest) {
  return handleInternalRoute('weekly-reminder', req, async () => {
    const today = appTodayIso()
    const { byYear } = await getGoalsPageData(today)
    const projection = byYear[Number(today.slice(0, 4))]?.projection

    if (!projection) {
      return NextResponse.json({ sent: false })
    }

    const n = t.notifications.weeklyGoal
    await sendPushToAllDevices(
      n.title,
      n.body(n.status[projection.status], formatNumber(projection.weeklyRate), formatNumber(projection.weeklyNeeded))
    )

    return NextResponse.json({ sent: true, status: projection.status })
  })
}
