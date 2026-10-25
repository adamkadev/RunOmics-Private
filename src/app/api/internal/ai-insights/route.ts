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
import { openSpender } from '@/lib/aiSpend'
import { generateInsight } from '@/lib/gemini'
import { sendPush } from '@/lib/sendPushNotification'
import { loadData } from '@/application/usecases/LoadData'

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
      notify: (insight) => sendPush('training', insight.headline, insight.body),
      now: () => new Date(),
    }

    const report = await runInsightPass(deps, insightSurfaces(), {
      limit: requestedLimit(req),
      ignoreHorizon: req.nextUrl.searchParams.get('all') === '1',
    })
    return NextResponse.json(report)
  })
}

export function requestedLimit(req: NextRequest): number {
  const param = req.nextUrl.searchParams.get('limit')
  if (param === null) return DEFAULT_RUN_VERDICTS_PER_RUN

  const raw = Number(param)
  if (!Number.isInteger(raw) || raw < 0) return DEFAULT_RUN_VERDICTS_PER_RUN
  return Math.min(raw, MAX_RUN_VERDICTS_PER_RUN)
}
