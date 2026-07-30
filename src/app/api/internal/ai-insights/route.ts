import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { getActivities } from '@/application/usecases/GetActivities'
import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getSeasonHeadline } from '@/application/usecases/GetSeasonHeadline'
import { getWeeklyDigest } from '@/application/usecases/GetWeeklyDigest'
import { getCurrentWeekPurpose } from '@/application/usecases/GetCurrentWeekPurpose'
import { getRecords, getMostRecentRecord } from '@/application/usecases/GetRecords'
import { getRaceReadiness } from '@/application/usecases/GetRaceReadiness'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getShoeDetail } from '@/application/usecases/GetShoeDetail'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getLoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import { getLoadBalance } from '@/application/usecases/GetLoadBalance'
import { getThresholdHistory } from '@/application/usecases/GetThresholdHistory'
import { getGarminRacePredictions } from '@/application/usecases/GetGarminRacePredictions'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { analyticsTabFacts } from '@/application/usecases/GetAnalyticsTabFacts'
import { verdictTone } from '@/domain/training/readiness'
import { wearOutlook } from '@/domain/shoe/wearStatus'
import type { Limits } from '@/domain/ai/prompt'
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
  WEEKLY_REVIEW_LIMITS,
  WEEKLY_REVIEW_MODEL,
  WEEKLY_REVIEW_SURFACE,
  WEEKLY_REVIEW_SYSTEM_INSTRUCTION,
  weeklyReviewInsightHash,
  weeklyReviewInsightPrompt,
} from '@/domain/ai/weeklyReviewInsight'
import {
  WEEK_PURPOSE_LIMITS,
  WEEK_PURPOSE_MODEL,
  WEEK_PURPOSE_SURFACE,
  WEEK_PURPOSE_SYSTEM_INSTRUCTION,
  weekPurposeInsightHash,
  weekPurposeInsightPrompt,
} from '@/domain/ai/weekPurposeInsight'
import {
  PB_CELEBRATION_LIMITS,
  PB_CELEBRATION_MODEL,
  PB_CELEBRATION_SURFACE,
  PB_CELEBRATION_SYSTEM_INSTRUCTION,
  celebratedRecord,
  pbCelebrationInsightHash,
  pbCelebrationInsightPrompt,
} from '@/domain/ai/pbCelebrationInsight'
import {
  SHOE_VERDICT_LIMITS,
  SHOE_VERDICT_MODEL,
  SHOE_VERDICT_SYSTEM_INSTRUCTION,
  shoeVerdictInsightHash,
  shoeVerdictInsightPrompt,
  shoeVerdictSurface,
  type ShoeVerdictContext,
} from '@/domain/ai/shoeVerdictInsight'
import {
  RACE_READINESS_LIMITS,
  RACE_READINESS_MODEL,
  RACE_READINESS_SURFACE,
  RACE_READINESS_SYSTEM_INSTRUCTION,
  raceReadinessInsightHash,
  raceReadinessInsightPrompt,
} from '@/domain/ai/raceReadinessInsight'
import {
  ANALYTICS_TAB_IDS,
  ANALYTICS_TAB_LIMITS,
  ANALYTICS_TAB_MODEL,
  analyticsTabInsightHash,
  analyticsTabInsightPrompt,
  analyticsTabSurface,
  analyticsTabSystemInstruction,
} from '@/domain/ai/analyticsTabInsight'
import {
  getCachedInsight,
  listCachedHashes,
  saveCachedInsight,
} from '@/infrastructure/repositories/FirestoreInsightsRepository'
import { openSpender, type Spender } from '@/lib/aiSpend'
import { generateInsight } from '@/lib/gemini'

// Pacing hero-model calls costs 13s each, so a batch needs room to breathe. The
// spender stops the run well before this ceiling.
export const maxDuration = 60

// The daily quota and the run's own clock are the spender's business now, so
// this only caps how many verdicts one invocation even attempts. A bulk pass is
// several calls to this route rather than one large ?limit=N: at the hero
// model's rate limit, sixty verdicts is a quarter of an hour of pacing that no
// serverless invocation can hold open.
const DEFAULT_RUN_VERDICTS_PER_RUN = 6
const MAX_RUN_VERDICTS_PER_RUN = 60

interface SurfaceJob {
  surface: string
  model: string
  limits: Limits
  systemInstruction: string
  hash: string
  prompt: (recentHeadlines: string[]) => string
}

interface SurfaceOutcome {
  generated: boolean
  reason?: string
}

/**
 * The whole life of one cached insight: skip it while its facts have not moved,
 * ask the spender before touching the API, and only then generate and store.
 * Every surface goes through here, so none of them can bypass the budget.
 */
async function runSurface(spender: Spender, job: SurfaceJob): Promise<SurfaceOutcome> {
  const cached = await getCachedInsight(job.surface)
  if (cached?.hash === job.hash) return { generated: false, reason: 'unchanged' }
  if (!(await spender.reserve(job.model))) return { generated: false, reason: 'no budget left' }

  const result = await generateInsight({
    model: job.model,
    systemInstruction: job.systemInstruction,
    prompt: job.prompt(cached?.recentHeadlines ?? []),
    limits: job.limits,
  })
  if (!result.ok) {
    if (result.reason.startsWith('http 429')) spender.exhaust(job.model)
    return { generated: false, reason: result.reason }
  }

  await saveCachedInsight(job.surface, result.insight, job.hash, cached)
  return { generated: true }
}

export async function POST(req: NextRequest) {
  return handleInternalRoute('ai-insights', req, async () => {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ skipped: 'no api key' })
    }

    const spender = await openSpender()

    // Order is priority order, alternating models on purpose: spacing is counted
    // per model, so a lite call between two hero calls runs inside the wait the
    // hero model owes anyway instead of adding to it. What the run budget cuts
    // off is picked up by the next run, so the tail is the copy that can wait -
    // and the run-verdict backfill, which has always caught up gradually.
    return NextResponse.json({
      today: await generateToday(spender),
      weekPurpose: await generateWeekPurpose(spender),
      weeklyReview: await generateWeeklyReview(spender),
      raceReadiness: await generateRaceReadiness(spender),
      season: await generateSeason(spender),
      analyticsTabs: await generateAnalyticsTabs(spender),
      pbCelebration: await generatePbCelebration(spender),
      shoeVerdicts: await generateShoeVerdicts(spender),
      runVerdicts: await generateRunVerdicts(spender, requestedLimit(req)),
      spend: spender.report(),
    })
  })
}

// ?limit=0 reports how much backfill is left without spending any quota.
function requestedLimit(req: NextRequest): number {
  const raw = Number(req.nextUrl.searchParams.get('limit'))
  if (!Number.isInteger(raw) || raw < 0) return DEFAULT_RUN_VERDICTS_PER_RUN
  return Math.min(raw, MAX_RUN_VERDICTS_PER_RUN)
}

async function generateToday(spender: Spender) {
  const status = await getTrainingStatus()
  if (!status) return { generated: false, reason: 'no training status' }

  const context = { status, tone: verdictTone(status), plannedWorkout: await getTodayPlannedWorkout() }

  return runSurface(spender, {
    surface: TODAY_SURFACE,
    model: TODAY_MODEL,
    limits: TODAY_LIMITS,
    systemInstruction: TODAY_SYSTEM_INSTRUCTION,
    hash: todayInsightHash(context),
    prompt: (recent) => todayInsightPrompt(context, recent),
  })
}

async function generateWeeklyReview(spender: Spender) {
  const digest = await getWeeklyDigest()
  if (!digest) return { generated: false, reason: 'no week to review' }

  return runSurface(spender, {
    surface: WEEKLY_REVIEW_SURFACE,
    model: WEEKLY_REVIEW_MODEL,
    limits: WEEKLY_REVIEW_LIMITS,
    systemInstruction: WEEKLY_REVIEW_SYSTEM_INSTRUCTION,
    hash: weeklyReviewInsightHash(digest),
    prompt: (recent) => weeklyReviewInsightPrompt(digest, recent),
  })
}

async function generateSeason(spender: Spender) {
  const data = getSeasonHeadline(await getAnalyticsData(), getYearComparison())
  if (!data) return { generated: false, reason: 'no season reads' }

  return runSurface(spender, {
    surface: SEASON_SURFACE,
    model: SEASON_MODEL,
    limits: SEASON_LIMITS,
    systemInstruction: SEASON_SYSTEM_INSTRUCTION,
    hash: seasonInsightHash(data),
    prompt: (recent) => seasonInsightPrompt(data, recent),
  })
}

async function generatePbCelebration(spender: Spender) {
  const record = celebratedRecord(getMostRecentRecord(await getRecords()), new Date())
  if (!record) return { generated: false, reason: 'no fresh record' }

  return runSurface(spender, {
    surface: PB_CELEBRATION_SURFACE,
    model: PB_CELEBRATION_MODEL,
    limits: PB_CELEBRATION_LIMITS,
    systemInstruction: PB_CELEBRATION_SYSTEM_INSTRUCTION,
    hash: pbCelebrationInsightHash(record),
    prompt: (recent) => pbCelebrationInsightPrompt(record, recent),
  })
}

async function generateWeekPurpose(spender: Spender) {
  const week = await getCurrentWeekPurpose()
  if (!week) return { generated: false, reason: 'no week data' }

  return runSurface(spender, {
    surface: WEEK_PURPOSE_SURFACE,
    model: WEEK_PURPOSE_MODEL,
    limits: WEEK_PURPOSE_LIMITS,
    systemInstruction: WEEK_PURPOSE_SYSTEM_INSTRUCTION,
    hash: weekPurposeInsightHash(week),
    prompt: (recent) => weekPurposeInsightPrompt(week, recent),
  })
}

async function generateRaceReadiness(spender: Spender) {
  const readiness = await getRaceReadiness()
  if (!readiness) return { generated: false, reason: 'no upcoming race' }

  return runSurface(spender, {
    surface: RACE_READINESS_SURFACE,
    model: RACE_READINESS_MODEL,
    limits: RACE_READINESS_LIMITS,
    systemInstruction: RACE_READINESS_SYSTEM_INSTRUCTION,
    hash: raceReadinessInsightHash(readiness),
    prompt: (recent) => raceReadinessInsightPrompt(readiness, recent),
  })
}

async function generateShoeVerdicts(spender: Spender) {
  const results: Record<string, string> = {}

  for (const stats of getShoeStats()) {
    if (stats.retired) continue
    const shoe = getShoeDetail(stats.gearId)
    if (!shoe) continue

    const outlook = wearOutlook(shoe)
    if (outlook.status === 'ok') continue

    const context: ShoeVerdictContext = { shoe, ...outlook, status: outlook.status }
    const outcome = await runSurface(spender, {
      surface: shoeVerdictSurface(shoe.gearId),
      model: SHOE_VERDICT_MODEL,
      limits: SHOE_VERDICT_LIMITS,
      systemInstruction: SHOE_VERDICT_SYSTEM_INSTRUCTION,
      hash: shoeVerdictInsightHash(context),
      prompt: (recent) => shoeVerdictInsightPrompt(context, recent),
    })
    results[shoe.gearId] = outcome.generated ? 'generated' : (outcome.reason ?? 'skipped')
  }

  return results
}

async function generateAnalyticsTabs(spender: Spender) {
  const facts = analyticsTabFacts({
    data: await getAnalyticsData(),
    status: await getTrainingStatus(),
    load: await getTrainingLoad(),
    loadRisk: await getLoadRiskPanel(),
    loadBalance: getLoadBalance(),
    threshold: getThresholdHistory(),
    racePredictions: getGarminRacePredictions(),
    vo2max: getLatestVO2max(),
  })

  const results: Record<string, string> = {}
  for (const tab of ANALYTICS_TAB_IDS) {
    const lines = facts[tab]
    if (!lines.length) {
      results[tab] = 'no reads'
      continue
    }

    const outcome = await runSurface(spender, {
      surface: analyticsTabSurface(tab),
      model: ANALYTICS_TAB_MODEL,
      limits: ANALYTICS_TAB_LIMITS,
      systemInstruction: analyticsTabSystemInstruction(tab),
      hash: analyticsTabInsightHash(tab, lines),
      prompt: (recent) => analyticsTabInsightPrompt(lines, recent),
    })
    results[tab] = outcome.generated ? 'generated' : (outcome.reason ?? 'skipped')
  }

  return results
}

async function generateRunVerdicts(spender: Spender, limit: number) {
  const cachedHashes = await listCachedHashes(RUN_VERDICT_PREFIX)
  const outstanding = getActivities().filter(
    (activity) => cachedHashes.get(runVerdictSurface(activity.id)) !== runVerdictInsightHash(activity)
  )
  const pending = outstanding.slice(0, limit)

  // Each verdict lives in its own document, so the only anti-repetition signal
  // available is what this same batch already wrote - which is exactly where
  // near-identical easy runs would otherwise read as copy-paste.
  const written: string[] = []
  const failures: string[] = []

  for (const activity of pending) {
    // One call covers the daily ceiling, the per-minute spacing and the time
    // left in this invocation. Whatever it refuses the next run picks up.
    if (!(await spender.reserve(RUN_VERDICT_MODEL))) break

    const result = await generateInsight({
      model: RUN_VERDICT_MODEL,
      systemInstruction: RUN_VERDICT_SYSTEM_INSTRUCTION,
      prompt: runVerdictInsightPrompt(activity, written),
      limits: RUN_VERDICT_LIMITS,
    })
    if (!result.ok) {
      failures.push(`${activity.id}: ${result.reason}`)
      if (result.reason.startsWith('http 429')) {
        spender.exhaust(RUN_VERDICT_MODEL)
        break
      }
      continue
    }

    await saveCachedInsight(runVerdictSurface(activity.id), result.insight, runVerdictInsightHash(activity), null)
    written.push(result.insight.headline)
  }

  return { outstanding: outstanding.length, generated: written.length, failures }
}
