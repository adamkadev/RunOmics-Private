import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPush } from '@/lib/sendPushNotification'
import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { appTodayIso } from '@/lib/calendarDate'
import { formatNumber } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export async function POST(req: NextRequest) {
  return handleInternalRoute('weekly-reminder', req, async () => {
    await loadData()
    const today = appTodayIso()
    const { byYear } = await getGoalsPageData(today)
    const projection = byYear[Number(today.slice(0, 4))]?.projection

    if (!projection) {
      return NextResponse.json({ sent: false })
    }

    const n = t.notifications.weeklyGoal
    await sendPush(
      'training',
      n.title,
      n.body(n.status[projection.status], formatNumber(projection.weeklyRate), formatNumber(projection.weeklyNeeded))
    )

    return NextResponse.json({ sent: true, status: projection.status })
  })
}
