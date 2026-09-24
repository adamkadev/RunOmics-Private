import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushesToAllDevices } from '@/lib/sendPushNotification'
import { getNewPrs } from '@/application/usecases/GetNewPrs'
import { formatDuration } from '@/lib/formatters'

export async function POST(req: NextRequest) {
  return handleInternalRoute('pr-check', req, async () => {
    const { newPrs, commit } = await getNewPrs()

    // Every PR is pushed even if one before it failed, and the marks are
    // stored only once all of them went out. A failure therefore offers the
    // whole batch again next run, announcing the PRs that did get through a
    // second time: a rare duplicate beats a PR that is never announced.
    await sendPushesToAllDevices(
      newPrs.map((pr) => ({ title: `New PR: ${pr.label}`, body: `${formatDuration(pr.seconds)} - new personal best!` }))
    )
    await commit()

    return NextResponse.json({ newPrs })
  })
}
