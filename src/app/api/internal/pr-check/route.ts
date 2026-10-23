import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushesToAllDevices } from '@/lib/sendPushNotification'
import { getNewPrs } from '@/application/usecases/GetNewPrs'
import { formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'

export async function POST(req: NextRequest) {
  return handleInternalRoute('pr-check', req, async () => {
    const { newPrs, commit } = await getNewPrs()

    // The marks are stored only once every push went out: a rare duplicate beats a PR that is never announced.
    await sendPushesToAllDevices(
      newPrs.map((pr) => ({ title: t.notifications.newPr.title(pr.label), body: t.notifications.newPr.body(formatDuration(pr.seconds)) }))
    )
    await commit()

    return NextResponse.json({ newPrs })
  })
}
