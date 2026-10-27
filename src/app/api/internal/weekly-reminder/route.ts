import { NextResponse } from 'next/server'
import { scheduledRoute } from '@/lib/internalRoute'
import { sendPush } from '@/lib/sendPushNotification'
import { pushPaths } from '@/lib/pushLinks'
import { getGoalsPageData } from '@/application/usecases/GetGoalsData'
import { getCoachingReminder } from '@/application/usecases/GetCoachingReminder'
import { opsStrings, sendOpsPush } from '@/lib/opsPush'
import { sendOncePer } from '@/application/usecases/SendScheduledPush'
import { appTodayIso } from '@/lib/calendarDate'
import { formatNumber } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

/** Nothing in the app renews a block or runs a review, so the one reminder the operator gets rides this week's cron. */
async function remindAboutTheBlock(today: string): Promise<boolean> {
  const reminder = getCoachingReminder(today)
  if (!reminder) return false

  const c = opsStrings.coachBlock
  const reasons = [
    reminder.blockEndsInDays === null ? null : c.endsIn(reminder.blockEndsInDays),
    !reminder.reviewOverdue ? null : reminder.daysSinceReview === null ? c.reviewNever : c.reviewAge(reminder.daysSinceReview),
  ].filter((reason): reason is string => reason !== null)

  return sendOncePer('coachBlock', today, () => sendOpsPush({ title: c.title, body: c.body(reasons.join(' · ')), link: pushPaths.plan, tag: 'coach-block' }))
}

async function askForTheGoal(year: number): Promise<boolean> {
  const n = t.notifications.goalYear
  return sendOncePer('goalYear', String(year), () => sendPush('training', { title: n.title(year), body: n.body, link: pushPaths.goals, tag: 'goal-year' }))
}

export const { GET, POST } = scheduledRoute('weekly-reminder', async () => {
  await loadData()
  const today = appTodayIso()
  const coachBlock = await remindAboutTheBlock(today)
  const { byYear, missingGoalYear } = await getGoalsPageData(today)
  const goalYear = missingGoalYear !== null && (await askForTheGoal(missingGoalYear))
  const projection = byYear[Number(today.slice(0, 4))]?.projection

  if (!projection) {
    return NextResponse.json({ sent: false, coachBlock, goalYear })
  }

  const n = t.notifications.weeklyGoal
  const sent = await sendOncePer('weeklyReminder', today, () =>
    sendPush('training', {
      title: n.title,
      body: n.body(n.status[projection.status], formatNumber(projection.weeklyRate), formatNumber(projection.weeklyNeeded)),
      link: pushPaths.goals,
      tag: 'weekly-goal',
    })
  )

  return NextResponse.json(sent ? { sent: true, status: projection.status, coachBlock, goalYear } : { skipped: 'already sent today', coachBlock, goalYear })
})
