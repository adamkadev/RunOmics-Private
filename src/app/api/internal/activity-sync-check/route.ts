import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushes } from '@/lib/sendPushNotification'
import { getNewActivities } from '@/application/usecases/GetNewActivities'
import { formatDistance, formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export async function POST(req: NextRequest) {
  return handleInternalRoute('activity-sync-check', req, async () => {
    await loadData()
    const { newActivities, commit } = await getNewActivities()

    // Stored only once every push went out, as in pr-check.
    await sendPushes(
      'training',
      newActivities.map((activity) => ({
        title: t.notifications.newActivity.title(activity.description),
        body: [formatDistance(activity.distanceKm), formatDuration(activity.durationSeconds), t.activityTypes[activity.type]].join(' · '),
      }))
    )
    await commit()

    return NextResponse.json({ newActivities: newActivities.map((a) => a.id) })
  })
}
