import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushesToAllDevices } from '@/lib/sendPushNotification'
import { getExploreMilestones } from '@/application/usecases/GetExploreGains'
import { formatPercent } from '@/lib/formatters'
import { t } from '@/i18n'
import { loadData } from '@/application/usecases/LoadData'

export async function POST(req: NextRequest) {
  return handleInternalRoute('explore-check', req, async () => {
    await loadData()
    const { newlyComplete, completeCount, unitCount, commit } = await getExploreMilestones()
    const n = t.notifications.exploreComplete

    // Stored only once every push went out, as in pr-check.
    await sendPushesToAllDevices(newlyComplete.map((unit) => ({ title: n.title(unit.name), body: n.body(formatPercent(unit.pct), completeCount, unitCount) })))
    await commit()

    // A count, not the names: the sync prints this body into the Actions log.
    return NextResponse.json({ newlyComplete: newlyComplete.length })
  })
}
