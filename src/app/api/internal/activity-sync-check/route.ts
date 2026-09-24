import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushesToAllDevices } from '@/lib/sendPushNotification'
import { getNewActivities } from '@/application/usecases/GetNewActivities'
import { formatDistance, formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'

export async function POST(req: NextRequest) {
  return handleInternalRoute('activity-sync-check', req, async () => {
    const { newActivities, commit } = await getNewActivities()

    // Stored only once every push went out, as in pr-check.
    await sendPushesToAllDevices(
      newActivities.map((activity) => ({
        title: `New activity: ${activity.description}`,
        body: [formatDistance(activity.distanceKm), formatDuration(activity.durationSeconds), t.activityTypes[activity.type]].join(' · '),
      }))
    )
    await commit()

    return NextResponse.json({ newActivities: newActivities.map((a) => a.id) })
  })
}
