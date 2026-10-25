import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPush } from '@/lib/sendPushNotification'
import { getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { formatDurationWords, formatKm } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export async function POST(req: NextRequest) {
  return handleInternalRoute('daily-session', req, async () => {
    await loadData()
    const workout = await getTodayPlannedWorkout()

    if (!workout) {
      await sendPush('training', t.notifications.restDay.title, t.notifications.restDay.body)
      return NextResponse.json({ sent: true, restDay: true })
    }

    const parts: string[] = []
    if (workout.distanceM) parts.push(`${formatKm(workout.distanceM / 1000, 1)} km`)
    if (workout.durationSecs) parts.push(formatDurationWords(workout.durationSecs))
    const detail = parts.length ? parts.join(' · ') : null

    await sendPush('training', t.notifications.todaySession.title, t.notifications.todaySession.body(workout.name, detail))
    return NextResponse.json({ sent: true, restDay: false })
  })
}
