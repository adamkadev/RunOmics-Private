import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedInternalRequest } from '@/lib/internalAuth'
import { sendPushToAllDevices } from '@/lib/sendPushNotification'
import { getGoalsPageData } from '@/application/usecases/GetGoalsData'

const STATUS_LABEL = {
  ahead: 'ahead of pace',
  on_track: 'on track',
  behind: 'behind pace',
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedInternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { byYear } = await getGoalsPageData()
  const projection = byYear[new Date().getFullYear()]?.projection

  if (!projection) {
    return NextResponse.json({ sent: false })
  }

  await sendPushToAllDevices(
    'Weekly goal check-in',
    `You're ${STATUS_LABEL[projection.status]} at ${projection.weeklyRate} km/week (need ${projection.weeklyNeeded} km/week).`
  )

  return NextResponse.json({ sent: true, status: projection.status })
}
