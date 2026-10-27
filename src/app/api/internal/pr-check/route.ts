import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushes } from '@/lib/sendPushNotification'
import { pushPaths } from '@/lib/pushLinks'
import { getNewPrs } from '@/application/usecases/GetNewPrs'
import { getNewReturnMilestones } from '@/application/usecases/GetNewReturnMilestones'
import { formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export async function POST(req: NextRequest) {
  return handleInternalRoute('pr-check', req, async () => {
    await loadData()
    const { newPrs, commit } = await getNewPrs()
    const returned = await getNewReturnMilestones()

    // The marks are stored only once every push went out: a rare duplicate beats a PR that is never announced.
    await sendPushes(
      'records',
      newPrs.map((pr) => ({
        title: t.notifications.newPr.title(pr.label),
        body: t.notifications.newPr.body(formatDuration(pr.seconds)),
        link: pushPaths.run(pr.activityId),
        tag: `record:${pr.key}`,
      })).concat(returned.newMilestones.map((milestone) => ({
        title: t.returnProgress.push.title,
        body: t.returnProgress.push.body(t.returnProgress.milestones[milestone.key]),
        link: milestone.activityId ? pushPaths.run(milestone.activityId) : pushPaths.comeback,
        tag: `return:${milestone.key}`,
      })))
    )
    await commit()
    await returned.commit()

    return NextResponse.json({ newPrs, newReturnMilestones: returned.newMilestones })
  })
}
