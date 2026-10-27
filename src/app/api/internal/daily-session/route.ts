import { NextResponse } from 'next/server'
import { scheduledRoute } from '@/lib/internalRoute'
import { sendPush } from '@/lib/sendPushNotification'
import { pushPaths } from '@/lib/pushLinks'
import { getDailySession } from '@/application/usecases/GetDailySession'
import { sendOncePer } from '@/application/usecases/SendScheduledPush'
import { DAILY_SESSION_PUSH, isDailySessionHour, isDailySessionRetry } from '@/lib/dailySessionPush'
import { lastJobRun } from '@/application/usecases/JobEvents'
import { todayIso } from '@/lib/calendarDate'
import { formatDurationWords, formatKm } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

/** Garmin's calendar leads: it is what the watch will offer the athlete this morning. */
export const { GET, POST } = scheduledRoute('daily-session', async (trigger) => {
  const now = new Date()
  if (trigger === 'cron' && !isDailySessionHour(now) && !isDailySessionRetry(now, await lastJobRun('daily-session').catch(() => null))) {
    return NextResponse.json({ skipped: 'not 08:xx in Paris' })
  }

  await loadData()
  const today = todayIso(DAILY_SESSION_PUSH.timeZone, now)
  const session = await getDailySession(today)
  if (!session) return NextResponse.json({ skipped: 'nothing planned within a week' })

  const { workout } = session
  const parts: string[] = []
  if (workout?.distanceM) parts.push(`${formatKm(workout.distanceM / 1000, 1)} km`)
  if (workout?.durationSecs) parts.push(formatDurationWords(workout.durationSecs))
  const detail = parts.length ? parts.join(' · ') : null

  const push = workout
    ? { title: t.notifications.todaySession.title, body: t.notifications.todaySession.body(workout.name, detail) }
    : { title: t.notifications.restDay.title, body: t.notifications.restDay.body }
  const sent = await sendOncePer('dailySession', today, () => sendPush('training', { ...push, link: pushPaths.plan, tag: 'daily-session' }))
  if (!sent) return NextResponse.json({ skipped: 'already sent today' })
  return NextResponse.json({ sent: true, restDay: !workout, source: session.source })
})
