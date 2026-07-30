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
import { getRecords, getMostRecentRecord, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
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
  TODAY_POOL,
  TODAY_SURFACE,
  TODAY_SYSTEM_INSTRUCTION,
  todayInsightHash,
  todayInsightPrompt,
} from '@/domain/ai/todayInsight'
import {
  RUN_VERDICT_LIMITS,
  RUN_VERDICT_POOL,
  RUN_VERDICT_PREFIX,
  RUN_VERDICT_SYSTEM_INSTRUCTION,
  deservesVerdict,
  runVerdictInsightHash,
  runVerdictInsightPrompt,
  runVerdictSurface,
} from '@/domain/ai/runVerdictInsight'
import {
  SEASON_LIMITS,
  SEASON_POOL,
  SEASON_SURFACE,
  SEASON_SYSTEM_INSTRUCTION,
  seasonInsightHash,
  seasonInsightPrompt,
} from '@/domain/ai/seasonInsight'
import {
  WEEKLY_REVIEW_LIMITS,
  WEEKLY_REVIEW_POOL,
  WEEKLY_REVIEW_SURFACE,
  WEEKLY_REVIEW_SYSTEM_INSTRUCTION,
  weeklyReviewInsightHash,
  weeklyReviewInsightPrompt,
} from '@/domain/ai/weeklyReviewInsight'
import {
  WEEK_PURPOSE_LIMITS,
  WEEK_PURPOSE_POOL,
  WEEK_PURPOSE_SURFACE,
  WEEK_PURPOSE_SYSTEM_INSTRUCTION,
  weekPurposeInsightHash,
  weekPurposeInsightPrompt,
} from '@/domain/ai/weekPurposeInsight'
import {
  PB_CELEBRATION_LIMITS,
  PB_CELEBRATION_POOL,
  PB_CELEBRATION_SURFACE,
  PB_CELEBRATION_SYSTEM_INSTRUCTION,
  celebratedRecord,
  pbCelebrationInsightHash,
  pbCelebrationInsightPrompt,
} from '@/domain/ai/pbCelebrationInsight'
import {
  SHOE_VERDICT_LIMITS,
  SHOE_VERDICT_POOL,
  SHOE_VERDICT_SYSTEM_INSTRUCTION,
  shoeVerdictInsightHash,
  shoeVerdictInsightPrompt,
  shoeVerdictSurface,
  type ShoeVerdictContext,
} from '@/domain/ai/shoeVerdictInsight'
import {
  RACE_READINESS_LIMITS,
  RACE_READINESS_POOL,
  RACE_READINESS_SURFACE,
  RACE_READINESS_SYSTEM_INSTRUCTION,
  raceReadinessInsightHash,
  raceReadinessInsightPrompt,
} from '@/domain/ai/raceReadinessInsight'
import {
  ANALYTICS_TAB_IDS,
  ANALYTICS_TAB_LIMITS,
  ANALYTICS_TAB_POOL,
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

// Rate limits are per model, so a pool of four spends its first four calls
// back to back and only then starts pacing. The spender stops the run well
// before this ceiling either way.
export const maxDuration = 60

// The daily quotas and the run's own clock are the spender's business now, so
// this only caps how many verdicts one invocation even attempts. ?limit=N still
// buys a bigger manual pass, but a full backfill is several calls to this route
// rather than one: no serverless invocation can hold the pacing open that long.
const DEFAULT_RUN_VERDICTS_PER_RUN = 6
const MAX_RUN_VERDICTS_PER_RUN = 60

interface SurfaceJob {
  surface: string
  pool: string[]
  limits: Limits
  systemInstruction: string
  hash: string
  prompt: (recentHeadlines: string[]) => string
}

interface SurfaceOutcome {
  generated: boolean
  reason?: string
}

// A model that answers 429 has spent its day, and one that answers 404 has been
// retired out from under us. Both mean: stop asking, take the next in the pool.
function isModelClosed(reason: string): boolean {
  return reason.startsWith('http 429') || reason.startsWith('http 404')
}

/**
 * The whole life of one cached insight: skip it while its facts have not moved,
 * ask the spender which model may serve it, and only then generate and store.
 * Every surface goes through here, so none of them can bypass the budget.
 */
async function runSurface(spender: Spender, job: SurfaceJob): Promise<SurfaceOutcome> {
  const cached = await getCachedInsight(job.surface)
  if (cached?.hash === job.hash) return { generated: false, reason: 'unchanged' }

  const model = await spender.reserve(job.pool)
  if (!model) return { generated: false, reason: 'no budget left' }

  const result = await generateInsight({
    model,
    systemInstruction: job.systemInstruction,
    prompt: job.prompt(cached?.recentHeadlines ?? []),
    limits: job.limits,
  })
  if (!result.ok) {
    if (isModelClosed(result.reason)) spender.exhaust(model)
    return { generated: false, reason: `${model}: ${result.reason}` }
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

    // Order is priority order, alternating tiers on purpose: spacing is counted
    // per model, so a supporting call between two hero calls runs inside a wait
    // that was owed anyway instead of adding to it. What the run budget cuts off
    // is picked up by the next run, so the tail is the copy that can wait - and
    // the run-verdict backfill, which has always caught up gradually.
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
    pool: TODAY_POOL,
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
    pool: WEEKLY_REVIEW_POOL,
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
    pool: SEASON_POOL,
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
    pool: PB_CELEBRATION_POOL,
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
    pool: WEEK_PURPOSE_POOL,
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
    pool: RACE_READINESS_POOL,
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
      pool: SHOE_VERDICT_POOL,
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
      pool: ANALYTICS_TAB_POOL,
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
  // Every activity that holds a record or a top-three effort - the ones reached
  // from /records months after the fact.
  const recorded = new Set(Object.keys(getQualifiedEffortsByActivityId(await getRecords())))
  const now = new Date()

  // Activities come newest first, so the queue is already in the order they are
  // most likely to be read.
  const outstanding = getActivities().filter(
    (activity) => cachedHashes.get(runVerdictSurface(activity.id)) !== runVerdictInsightHash(activity)
  )
  const eligible = outstanding.filter((activity) => deservesVerdict(activity, recorded, now))
  const pending = eligible.slice(0, limit)

  // Each verdict lives in its own document, so the only anti-repetition signal
  // available is what this same batch already wrote - which is exactly where
  // near-identical easy runs would otherwise read as copy-paste.
  const written: string[] = []
  const failures: string[] = []

  for (const activity of pending) {
    // One call covers every daily ceiling in the pool, the per-minute spacing
    // and the time left in this invocation. What it refuses, the next run picks
    // up - and with four models to draw from, it refuses far later than one.
    const model = await spender.reserve(RUN_VERDICT_POOL)
    if (!model) break

    const result = await generateInsight({
      model,
      systemInstruction: RUN_VERDICT_SYSTEM_INSTRUCTION,
      prompt: runVerdictInsightPrompt(activity, written),
      limits: RUN_VERDICT_LIMITS,
    })
    if (!result.ok) {
      failures.push(`${activity.id} (${model}): ${result.reason}`)
      // Only this model is done, not the batch: the next reserve moves on to
      // the next model in the pool.
      if (isModelClosed(result.reason)) spender.exhaust(model)
      continue
    }

    await saveCachedInsight(runVerdictSurface(activity.id), result.insight, runVerdictInsightHash(activity), null)
    written.push(result.insight.headline)
  }

  return { outstanding: outstanding.length, eligible: eligible.length, generated: written.length, failures }
}
