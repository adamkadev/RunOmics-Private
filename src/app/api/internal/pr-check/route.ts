import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushes } from '@/lib/sendPushNotification'
import { getNewPrs } from '@/application/usecases/GetNewPrs'
import { formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export async function POST(req: NextRequest) {
  return handleInternalRoute('pr-check', req, async () => {
    await loadData()
    const { newPrs, commit } = await getNewPrs()

    // The marks are stored only once every push went out: a rare duplicate beats a PR that is never announced.
    await sendPushes(
      'records',
      newPrs.map((pr) => ({ title: t.notifications.newPr.title(pr.label), body: t.notifications.newPr.body(formatDuration(pr.seconds)) }))
    )
    await commit()

    return NextResponse.json({ newPrs })
  })
}
