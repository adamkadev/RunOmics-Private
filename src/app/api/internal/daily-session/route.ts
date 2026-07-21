import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushToAllDevices } from '@/lib/sendPushNotification'
import { getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { formatDurationWords } from '@/lib/formatters'

export async function POST(req: NextRequest) {
  return handleInternalRoute('daily-session', req, async () => {
    const workout = await getTodayPlannedWorkout()

    if (!workout) {
      await sendPushToAllDevices('Rest day', 'No session scheduled today - recovery day.')
      return NextResponse.json({ sent: true, restDay: true })
    }

    const parts: string[] = []
    if (workout.distanceM) parts.push(`${(workout.distanceM / 1000).toFixed(1)} km`)
    if (workout.durationSecs) parts.push(formatDurationWords(workout.durationSecs))
    const detail = parts.length ? ` (${parts.join(' · ')})` : ''

    await sendPushToAllDevices("Today's session", `${workout.name}${detail}`)
    return NextResponse.json({ sent: true, restDay: false })
  })
}
