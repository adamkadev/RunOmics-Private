import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { handleInternalRoute } from '@/lib/internalRoute'
import { runInsightPass, type InsightPassDeps } from '@/application/ai/insightPass'
import { insightSurfaces } from '@/application/ai/surfaces'
import {
  getCachedInsight,
  listCachedKeys,
  readVerdictPhrasing,
  saveCachedInsight,
  saveVerdictPhrasing,
} from '@/infrastructure/repositories/FirestoreInsightsRepository'
import { openSpender } from '@/application/ai/aiSpend'
import { generateInsight } from '@/lib/gemini'
import { sendPush } from '@/lib/sendPushNotification'
import { pushPaths } from '@/lib/pushLinks'
import { loadData } from '@/application/usecases/LoadData'
import { recordAiPass } from '@/application/usecases/AiPassStatus'
import { IDLE_NIGHTS_BEFORE_ALERT } from '@/domain/ai/passStatus'
import { integrationStatus } from '@/infrastructure/integrations'
import { opsStrings, sendOpsPush } from '@/lib/opsPush'

export const maxDuration = 300

const DEFAULT_RUN_VERDICTS_PER_RUN = 24
const MAX_RUN_VERDICTS_PER_RUN = 60

export async function POST(req: NextRequest) {
  return handleInternalRoute('ai-insights', req, async () => {
    await loadData()
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ skipped: 'no api key' })
    }

    const deps: InsightPassDeps = {
      spender: await openSpender(),
      insights: { getCachedInsight, saveCachedInsight, listCachedKeys, readVerdictPhrasing, saveVerdictPhrasing },
      generate: generateInsight,
      revalidate: (path) => revalidatePath(path),
      notify: (insight, activityId) =>
        sendPush('training', { title: insight.headline, body: insight.body, link: pushPaths.run(activityId), tag: `verdict:${activityId}` }),
      now: () => new Date(),
    }

    const limit = requestedLimit(req)
    const report = await runInsightPass(deps, insightSurfaces(), {
      limit,
      ignoreHorizon: req.nextUrl.searchParams.get('all') === '1',
    })
    // A limit of 0 only counts the backlog: it is not a night's attempt.
    if (limit > 0 && integrationStatus().firebaseAdmin) await keepPassStatus(report)
    return NextResponse.json(report)
  })
}

/** The pass's work is saved already, so a status or alert that fails is logged and never fails it. */
async function keepPassStatus(report: Awaited<ReturnType<typeof runInsightPass>>): Promise<void> {
  try {
    const { status, alert } = await recordAiPass(report)
    if (!alert) return
    const n = opsStrings.aiIdle
    const closed = status.closedModels.map((model) => model.model).join(', ')
    await sendOpsPush({ title: n.title(IDLE_NIGHTS_BEFORE_ALERT), body: n.body(closed), link: pushPaths.settings, tag: 'ai-idle' })
  } catch (error) {
    console.error('[ai-insights] could not keep the pass status', error)
  }
}

export function requestedLimit(req: NextRequest): number {
  const param = req.nextUrl.searchParams.get('limit')
  if (param === null) return DEFAULT_RUN_VERDICTS_PER_RUN

  const raw = Number(param)
  if (!Number.isInteger(raw) || raw < 0) return DEFAULT_RUN_VERDICTS_PER_RUN
  return Math.min(raw, MAX_RUN_VERDICTS_PER_RUN)
}
