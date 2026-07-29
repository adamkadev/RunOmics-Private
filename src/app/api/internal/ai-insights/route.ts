import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { getActivities } from '@/application/usecases/GetActivities'
import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getSeasonHeadline } from '@/application/usecases/GetSeasonHeadline'
import { verdictTone } from '@/domain/training/readiness'
import {
  TODAY_LIMITS,
  TODAY_MODEL,
  TODAY_SURFACE,
  TODAY_SYSTEM_INSTRUCTION,
  todayInsightHash,
  todayInsightPrompt,
} from '@/domain/ai/todayInsight'
import {
  RUN_VERDICT_LIMITS,
  RUN_VERDICT_MODEL,
  RUN_VERDICT_PREFIX,
  RUN_VERDICT_SYSTEM_INSTRUCTION,
  runVerdictInsightHash,
  runVerdictInsightPrompt,
  runVerdictSurface,
} from '@/domain/ai/runVerdictInsight'
import {
  SEASON_LIMITS,
  SEASON_MODEL,
  SEASON_SURFACE,
  SEASON_SYSTEM_INSTRUCTION,
  seasonInsightHash,
  seasonInsightPrompt,
} from '@/domain/ai/seasonInsight'
import {
  getCachedInsight,
  listCachedHashes,
  saveCachedInsight,
} from '@/infrastructure/repositories/FirestoreInsightsRepository'
import { generateInsight } from '@/lib/gemini'

// Sized so a batch finishes well inside a serverless function's budget. The
// quota is not the binding constraint here (the lite model allows 500 a day);
// pass ?limit=N to run a bigger backfill pass by hand, where nothing times out.
const DEFAULT_RUN_VERDICTS_PER_RUN = 6
const MAX_RUN_VERDICTS_PER_RUN = 60

// The lite model allows 15 requests a minute.
const RATE_LIMIT_PAUSE_MS = 5000

export async function POST(req: NextRequest) {
  return handleInternalRoute('ai-insights', req, async () => {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ skipped: 'no api key' })
    }

    return NextResponse.json({
      today: await generateToday(),
      runVerdicts: await generateRunVerdicts(requestedLimit(req)),
      season: await generateSeason(),
    })
  })
}

function requestedLimit(req: NextRequest): number {
  const raw = Number(req.nextUrl.searchParams.get('limit'))
  if (!Number.isInteger(raw) || raw < 1) return DEFAULT_RUN_VERDICTS_PER_RUN
  return Math.min(raw, MAX_RUN_VERDICTS_PER_RUN)
}

async function generateToday() {
  const status = await getTrainingStatus()
  if (!status) return { generated: false, reason: 'no training status' }

  const context = { status, tone: verdictTone(status), plannedWorkout: await getTodayPlannedWorkout() }
  const hash = todayInsightHash(context)

  const cached = await getCachedInsight(TODAY_SURFACE)
  if (cached?.hash === hash) return { generated: false, reason: 'unchanged' }

  const result = await generateInsight({
    model: TODAY_MODEL,
    systemInstruction: TODAY_SYSTEM_INSTRUCTION,
    prompt: todayInsightPrompt(context, cached?.recentHeadlines ?? []),
    limits: TODAY_LIMITS,
  })
  if (!result.ok) return { generated: false, reason: result.reason }

  await saveCachedInsight(TODAY_SURFACE, result.insight, hash, cached)
  return { generated: true, insight: result.insight }
}

async function generateRunVerdicts(limit: number) {
  const cachedHashes = await listCachedHashes(RUN_VERDICT_PREFIX)
  const pending = getActivities()
    .filter((activity) => cachedHashes.get(runVerdictSurface(activity.id)) !== runVerdictInsightHash(activity))
    .slice(0, limit)

  // Each verdict lives in its own document, so the only anti-repetition signal
  // available is what this same batch already wrote - which is exactly where
  // near-identical easy runs would otherwise read as copy-paste.
  const written: string[] = []
  const failures: string[] = []

  for (const [index, activity] of pending.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_PAUSE_MS))

    const result = await generateInsight({
      model: RUN_VERDICT_MODEL,
      systemInstruction: RUN_VERDICT_SYSTEM_INSTRUCTION,
      prompt: runVerdictInsightPrompt(activity, written),
      limits: RUN_VERDICT_LIMITS,
    })
    if (!result.ok) {
      failures.push(`${activity.id}: ${result.reason}`)
      // Once the quota window is shut every remaining candidate fails the same
      // way, and each attempt still counts against the daily allowance. Stop
      // and let the next pass pick the batch up.
      if (result.reason.startsWith('http 429')) break
      continue
    }

    await saveCachedInsight(runVerdictSurface(activity.id), result.insight, runVerdictInsightHash(activity), null)
    written.push(result.insight.headline)
  }

  return { candidates: pending.length, generated: written.length, failures }
}

async function generateSeason() {
  const data = getSeasonHeadline(await getAnalyticsData(), getYearComparison())
  if (!data) return { generated: false, reason: 'no season reads' }

  const hash = seasonInsightHash(data)
  const cached = await getCachedInsight(SEASON_SURFACE)
  if (cached?.hash === hash) return { generated: false, reason: 'unchanged' }

  const result = await generateInsight({
    model: SEASON_MODEL,
    systemInstruction: SEASON_SYSTEM_INSTRUCTION,
    prompt: seasonInsightPrompt(data, cached?.recentHeadlines ?? []),
    limits: SEASON_LIMITS,
  })
  if (!result.ok) return { generated: false, reason: result.reason }

  await saveCachedInsight(SEASON_SURFACE, result.insight, hash, cached)
  return { generated: true, insight: result.insight }
}
