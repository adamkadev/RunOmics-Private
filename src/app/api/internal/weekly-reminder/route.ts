import { NextResponse } from 'next/server'
import { scheduledRoute } from '@/lib/internalRoute'
import { sendPush } from '@/lib/sendPushNotification'
import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { sendOncePer } from '@/application/usecases/SendScheduledPush'
import { appTodayIso } from '@/lib/calendarDate'
import { formatNumber } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export const { GET, POST } = scheduledRoute('weekly-reminder', async () => {
  await loadData()
  const today = appTodayIso()
  const { byYear } = await getGoalsPageData(today)
  const projection = byYear[Number(today.slice(0, 4))]?.projection

  if (!projection) {
    return NextResponse.json({ sent: false })
  }

  const n = t.notifications.weeklyGoal
  const sent = await sendOncePer('weeklyReminder', today, () =>
    sendPush(
      'training',
      n.title,
      n.body(n.status[projection.status], formatNumber(projection.weeklyRate), formatNumber(projection.weeklyNeeded))
    )
  )

  return NextResponse.json(sent ? { sent: true, status: projection.status } : { skipped: 'already sent today' })
})
