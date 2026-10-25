import { NextResponse } from 'next/server'
import { scheduledRoute } from '@/lib/internalRoute'
import { sendPush } from '@/lib/sendPushNotification'
import { getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { sendOncePer } from '@/application/usecases/SendScheduledPush'
import { DAILY_SESSION_PUSH, isDailySessionHour } from '@/lib/dailySessionPush'
import { todayIso } from '@/lib/calendarDate'
import { formatDurationWords, formatKm } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

/** Garmin's calendar, not the coach's plan: it is what the watch will offer the athlete this morning. */
export const { GET, POST } = scheduledRoute('daily-session', async (trigger) => {
  const now = new Date()
  if (trigger === 'cron' && !isDailySessionHour(now)) {
    return NextResponse.json({ skipped: 'not 08:xx in Paris' })
  }

  await loadData()
  const workout = await getTodayPlannedWorkout()

  const parts: string[] = []
  if (workout?.distanceM) parts.push(`${formatKm(workout.distanceM / 1000, 1)} km`)
  if (workout?.durationSecs) parts.push(formatDurationWords(workout.durationSecs))
  const detail = parts.length ? parts.join(' · ') : null

  const sent = await sendOncePer('dailySession', todayIso(DAILY_SESSION_PUSH.timeZone, now), () =>
    workout
      ? sendPush('training', t.notifications.todaySession.title, t.notifications.todaySession.body(workout.name, detail))
      : sendPush('training', t.notifications.restDay.title, t.notifications.restDay.body)
  )
  if (!sent) return NextResponse.json({ skipped: 'already sent today' })
  return NextResponse.json({ sent: true, restDay: !workout })
})
