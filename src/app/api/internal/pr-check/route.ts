import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedInternalRequest } from '@/lib/internalAuth'
import { sendPushToAllDevices } from '@/lib/sendPushNotification'
import { getNewPrs } from '@/application/usecases/GetNewPrs'
import { formatDuration } from '@/lib/formatters'

export async function POST(req: NextRequest) {
  if (!isAuthorizedInternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const newPrs = await getNewPrs()

  for (const pr of newPrs) {
    await sendPushToAllDevices(`New PR: ${pr.label}`, `${formatDuration(pr.seconds)} - new personal best!`)
  }

  return NextResponse.json({ newPrs })
}
