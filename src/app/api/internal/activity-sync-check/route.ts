import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushToAllDevices } from '@/lib/sendPushNotification'
import { getNewActivities } from '@/application/usecases/GetNewActivities'
import { formatDistance, formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'

export async function POST(req: NextRequest) {
  return handleInternalRoute('activity-sync-check', req, async () => {
    const newActivities = await getNewActivities()

    for (const activity of newActivities) {
      const detail = [formatDistance(activity.distanceKm), formatDuration(activity.durationSeconds), t.activityTypes[activity.type]].join(' · ')
      await sendPushToAllDevices(`New activity: ${activity.description}`, detail)
    }

    return NextResponse.json({ newActivities: newActivities.map((a) => a.id) })
  })
}
