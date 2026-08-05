import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { handleInternalRoute } from '@/lib/internalRoute'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getTodayPlannedWorkout } from '@/application/usecases/GetPlannedWorkouts'
import { getRunVerdictContexts } from '@/application/usecases/GetRunVerdictInsight'
import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getSeasonHeadline } from '@/application/usecases/GetSeasonHeadline'
import { getWeeklyDigest } from '@/application/usecases/GetWeeklyDigest'
import { getCurrentWeekPurpose } from '@/application/usecases/GetCurrentWeekPurpose'
import { getRecords, getMostRecentRecord, getQualifiedEffortsByActivityId } from '@/application/usecases/GetRecords'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getShoeDetail } from '@/application/usecases/GetShoeDetail'
import { getTrainingLoad } from '@/application/usecases/GetTrainingLoad'
import { getLoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import { getLoadBalance } from '@/application/usecases/GetLoadBalance'
import { getThresholdHistory } from '@/application/usecases/GetThresholdHistory'
import { getGarminRacePredictions } from '@/application/usecases/GetGarminRacePredictions'
import { getLatestVO2max } from '@/application/usecases/GetVO2maxHistory'
import { analyticsTabFacts } from '@/application/usecases/GetAnalyticsTabFacts'
import { buildTodayContext } from '@/application/usecases/GetTodayInsight'
import { buildPbCelebrationContext } from '@/application/usecases/GetPbCelebrationInsight'
import { wearOutlook } from '@/domain/shoe/wearStatus'
import type { Limits } from '@/domain/ai/prompt'
import {
  TODAY_LIMITS,
  TODAY_SURFACE,
  TODAY_SYSTEM_INSTRUCTION,
  todayInsightGuard,
  todayInsightHash,
  todayInsightPrompt,
} from '@/domain/ai/todayInsight'
import {
  RUN_VERDICT_LIMITS,
  RUN_VERDICT_PREFIX,
  RUN_VERDICT_SYSTEM_INSTRUCTION,
  deservesVerdict,
  isFreshRun,
  runVerdictInsightHash,
  runVerdictInsightPrompt,
  runVerdictSurface,
  type RunVerdictContext,
} from '@/domain/ai/runVerdictInsight'
import {
  SEASON_LIMITS,
  SEASON_SURFACE,
  SEASON_SYSTEM_INSTRUCTION,
  seasonInsightGuard,
  seasonInsightHash,
  seasonInsightPrompt,
} from '@/domain/ai/seasonInsight'
import {
  WEEKLY_REVIEW_LIMITS,
  WEEKLY_REVIEW_SURFACE,
  WEEKLY_REVIEW_SYSTEM_INSTRUCTION,
  weeklyReviewInsightHash,
  weeklyReviewInsightPrompt,
} from '@/domain/ai/weeklyReviewInsight'
import {
  WEEK_PURPOSE_LIMITS,
  WEEK_PURPOSE_SURFACE,
  WEEK_PURPOSE_SYSTEM_INSTRUCTION,
  weekPurposeInsightHash,
  weekPurposeInsightPrompt,
} from '@/domain/ai/weekPurposeInsight'
import {
  PB_CELEBRATION_LIMITS,
  PB_CELEBRATION_SURFACE,
  PB_CELEBRATION_SYSTEM_INSTRUCTION,
  celebratedRecord,
  pbCelebrationInsightHash,
  pbCelebrationInsightPrompt,
} from '@/domain/ai/pbCelebrationInsight'
import {
  SHOE_VERDICT_LIMITS,
  SHOE_VERDICT_SYSTEM_INSTRUCTION,
  shoeVerdictInsightGuard,
  shoeVerdictInsightHash,
  shoeVerdictInsightPrompt,
  shoeVerdictSurface,
  type ShoeVerdictContext,
} from '@/domain/ai/shoeVerdictInsight'
import {
  ANALYTICS_TAB_IDS,
  ANALYTICS_TAB_LIMITS,
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
import { MODEL_POOL, dailyBudget, spendField } from '@/domain/ai/budget'
import { openSpender, type Spender } from '@/lib/aiSpend'
import { generateInsight } from '@/lib/gemini'

// Rate limits are per model, so the pool spends its first few calls back to
// back and only then starts pacing. The spender stops the run well before this
// ceiling either way - see RUN_BUDGET_MS. 300s is the max on Hobby with Fluid
// Compute, confirmed on this deployment 2026-08-05.
export const maxDuration = 300

// The daily quotas and the run's own clock are the spender's business now, so
// this only caps how many verdicts one invocation even attempts. ?limit=N still
// buys a bigger manual pass, but a full backfill is several calls to this route
// rather than one: no serverless invocation can hold the pacing open that long.
const DEFAULT_RUN_VERDICTS_PER_RUN = 6
const MAX_RUN_VERDICTS_PER_RUN = 60

// Verdicts for runs that just landed are written before any other surface. They
// used to sit at the very end of the run, behind ten surfaces that could spend
// the day's quota or the invocation's clock first - so the one insight the
// athlete was actually waiting for was the first thing dropped. Small on
// purpose: it is a handful of runs a week, not a backfill.
const FRESH_RUN_VERDICTS_PER_RUN = 3

interface SurfaceJob {
  surface: string
  limits: Limits
  systemInstruction: string
  hash: string
  /**
   * Stored beside the copy so a reader can tell, once the facts have moved,
   * whether yesterday's line would now contradict what is rendered around it.
   * See InsightKey.guard; surfaces with nothing beside them leave it unset.
   */
  guard?: string
  prompt: (recentHeadlines: string[]) => string
  bulletCount?: number
  /**
   * Pages that render this surface. These are static (ISR, revalidate = 3600),
   * built once at deploy time - before this route ever runs, since the deploy
   * has to be live before the sync workflow calls it. Left alone, a fresh
   * insight would sit correct in Firestore for up to an hour while every page
   * kept serving the pre-generation snapshot. Revalidating on a successful
   * write is what makes it show up on the next request instead.
   */
  paths: string[]
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

// reserve() returning null used to be a dead end nobody could read back: was
// the pool actually spent for the day, or did this invocation just run out of
// its own clock? Same daily ledger the spender itself checks, read back after
// the fact so a stuck verdict says which one instead of leaving both plausible.
function noReserveReason(spender: Spender): string {
  const spent = spender.report()
  const budgetSpent = MODEL_POOL.every((model) => (spent[spendField(model)] ?? 0) >= dailyBudget(model))
  return budgetSpent ? 'no budget left' : 'no time left in this invocation'
}

/**
 * The whole life of one cached insight: skip it while its facts have not moved,
 * ask the spender which model may serve it, and only then generate and store.
 * Every surface goes through here, so none of them can bypass the budget.
 */
async function runSurface(spender: Spender, job: SurfaceJob): Promise<SurfaceOutcome> {
  const cached = await getCachedInsight(job.surface)
  if (cached?.hash === job.hash) return { generated: false, reason: 'unchanged' }

  const model = await spender.reserve(MODEL_POOL)
  if (!model) return { generated: false, reason: noReserveReason(spender) }

  const result = await generateInsight({
    model,
    systemInstruction: job.systemInstruction,
    prompt: job.prompt(cached?.recentHeadlines ?? []),
    limits: job.limits,
    bulletCount: job.bulletCount,
  })
  if (!result.ok) {
    if (isModelClosed(result.reason)) spender.exhaust(model)
    return { generated: false, reason: `${model}: ${result.reason}` }
  }

  await saveCachedInsight(job.surface, result.insight, job.hash, cached, job.guard)
  job.paths.forEach((path) => revalidatePath(path))
  return { generated: true }
}

export async function POST(req: NextRequest) {
  return handleInternalRoute('ai-insights', req, async () => {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ skipped: 'no api key' })
    }

    const spender = await openSpender()
    const limit = requestedLimit(req)
    const queue = await runVerdictQueue(ignoresHorizon(req))

    // Headlines written anywhere in this invocation, shared by both verdict
    // phases: each verdict lives in its own document, so what this batch has
    // already said is the only anti-repetition signal there is.
    const written: string[] = []

    // The run that just synced comes first. ?limit=0 still buys a report with
    // no spend at all, so it holds this phase back too.
    const fresh = limit === 0 ? [] : queue.fresh.slice(0, FRESH_RUN_VERDICTS_PER_RUN)

    // Then order is priority order: what the run budget cuts off is picked up by
    // the next run, so the tail is the copy that can wait - and the run-verdict
    // backfill, which has always caught up gradually.
    return NextResponse.json({
      freshVerdicts: await writeVerdicts(spender, fresh, written),
      today: await generateToday(spender),
      weekPurpose: await generateWeekPurpose(spender),
      weeklyReview: await generateWeeklyReview(spender),
      season: await generateSeason(spender),
      analyticsTabs: await generateAnalyticsTabs(spender),
      pbCelebration: await generatePbCelebration(spender),
      shoeVerdicts: await generateShoeVerdicts(spender),
      runVerdicts: {
        outstanding: queue.outstanding,
        eligible: queue.eligible,
        // Split out so a stuck verdict is diagnosable from this response alone:
        // fresh going in already 0 says the run isn't within the priority
        // window: freshVerdicts.generated staying 0 with fresh > 0 says it was
        // there but never got a reserve.
        fresh: queue.fresh.length,
        rest: queue.rest.length,
        // Fresh runs left over from the cap above lead the backfill rather than
        // waiting behind the archive for it.
        ...(await writeVerdicts(
          spender,
          [...queue.fresh.slice(fresh.length), ...queue.rest].slice(0, limit),
          written
        )),
      },
      spend: spender.report(),
    })
  })
}

// ?limit=0 reports how much backfill is left without spending any quota - but
// Number(null) is 0, and URLSearchParams.get returns null for a param that was
// never sent, not undefined. The cron and every workflow_dispatch call this
// route with no ?limit= at all, so this used to coerce straight to the
// explicit-opt-out value: every automated run silently generated zero run
// verdicts, fresh or backfilled, no matter how many were owed.
export function requestedLimit(req: NextRequest): number {
  const param = req.nextUrl.searchParams.get('limit')
  if (param === null) return DEFAULT_RUN_VERDICTS_PER_RUN

  const raw = Number(param)
  if (!Number.isInteger(raw) || raw < 0) return DEFAULT_RUN_VERDICTS_PER_RUN
  return Math.min(raw, MAX_RUN_VERDICTS_PER_RUN)
}

// ?all=1 lifts the recency horizon, for a manual pass over the archive after a
// reprocess moved the facts under verdicts nobody would open next week. The
// daily cron never sends it, so the steady state stays the runs still worth a
// call - at 20 requests a day per model, an archive pass is not a cron's job.
function ignoresHorizon(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('all') === '1'
}

async function generateToday(spender: Spender) {
  const status = await getTrainingStatus()
  if (!status) return { generated: false, reason: 'no training status' }

  const context = buildTodayContext(status, await getTodayPlannedWorkout())

  return runSurface(spender, {
    surface: TODAY_SURFACE,
    limits: TODAY_LIMITS,
    systemInstruction: TODAY_SYSTEM_INSTRUCTION,
    hash: todayInsightHash(context),
    guard: todayInsightGuard(context),
    prompt: (recent) => todayInsightPrompt(context, recent),
    paths: ['/'],
  })
}

async function generateWeeklyReview(spender: Spender) {
  const digest = await getWeeklyDigest()
  if (!digest) return { generated: false, reason: 'no week to review' }

  return runSurface(spender, {
    surface: WEEKLY_REVIEW_SURFACE,
    limits: WEEKLY_REVIEW_LIMITS,
    systemInstruction: WEEKLY_REVIEW_SYSTEM_INSTRUCTION,
    hash: weeklyReviewInsightHash(digest),
    prompt: (recent) => weeklyReviewInsightPrompt(digest, recent),
    paths: ['/'],
  })
}

async function generateSeason(spender: Spender) {
  const data = getSeasonHeadline(await getAnalyticsData(), getYearComparison())
  if (!data) return { generated: false, reason: 'no season reads' }

  return runSurface(spender, {
    surface: SEASON_SURFACE,
    limits: SEASON_LIMITS,
    systemInstruction: SEASON_SYSTEM_INSTRUCTION,
    hash: seasonInsightHash(data),
    guard: seasonInsightGuard(data),
    prompt: (recent) => seasonInsightPrompt(data, recent),
    bulletCount: data.bullets.length,
    paths: ['/analytics'],
  })
}

async function generatePbCelebration(spender: Spender) {
  const record = celebratedRecord(getMostRecentRecord(await getRecords()), new Date())
  if (!record) return { generated: false, reason: 'no fresh record' }

  const context = buildPbCelebrationContext(record)

  return runSurface(spender, {
    surface: PB_CELEBRATION_SURFACE,
    limits: PB_CELEBRATION_LIMITS,
    systemInstruction: PB_CELEBRATION_SYSTEM_INSTRUCTION,
    hash: pbCelebrationInsightHash(context),
    prompt: (recent) => pbCelebrationInsightPrompt(context, recent),
    paths: ['/'],
  })
}

async function generateWeekPurpose(spender: Spender) {
  const week = await getCurrentWeekPurpose()
  if (!week) return { generated: false, reason: 'no week data' }

  return runSurface(spender, {
    surface: WEEK_PURPOSE_SURFACE,
    limits: WEEK_PURPOSE_LIMITS,
    systemInstruction: WEEK_PURPOSE_SYSTEM_INSTRUCTION,
    hash: weekPurposeInsightHash(week),
    prompt: (recent) => weekPurposeInsightPrompt(week, recent),
    paths: ['/plan'],
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
        limits: SHOE_VERDICT_LIMITS,
      systemInstruction: SHOE_VERDICT_SYSTEM_INSTRUCTION,
      hash: shoeVerdictInsightHash(context),
      guard: shoeVerdictInsightGuard(context),
      prompt: (recent) => shoeVerdictInsightPrompt(context, recent),
      paths: [`/shoes/${shoe.gearId}`],
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
        limits: ANALYTICS_TAB_LIMITS,
      systemInstruction: analyticsTabSystemInstruction(tab),
      hash: analyticsTabInsightHash(tab, lines),
      prompt: (recent) => analyticsTabInsightPrompt(lines, recent),
      paths: ['/analytics'],
    })
    results[tab] = outcome.generated ? 'generated' : (outcome.reason ?? 'skipped')
  }

  return results
}

interface VerdictQueue {
  /** Runs recent enough to be written before the other surfaces. */
  fresh: RunVerdictContext[]
  /** Everything else still owed a verdict, newest first. */
  rest: RunVerdictContext[]
  outstanding: number
  eligible: number
}

/** Every run still owed a verdict, split into what is urgent and what can wait. */
async function runVerdictQueue(ignoreHorizon: boolean): Promise<VerdictQueue> {
  const cachedHashes = await listCachedHashes(RUN_VERDICT_PREFIX)
  // Every activity that holds a record or a top-three effort - the ones reached
  // from /records months after the fact.
  const recorded = new Set(Object.keys(getQualifiedEffortsByActivityId(await getRecords())))
  const now = new Date()

  // Activities come newest first, so the queue is already in the order they are
  // most likely to be read.
  const outstanding = getRunVerdictContexts().filter(
    (context) => cachedHashes.get(runVerdictSurface(context.activity.id)) !== runVerdictInsightHash(context)
  )
  const eligible = ignoreHorizon
    ? outstanding
    : outstanding.filter((context) => deservesVerdict(context.activity, recorded, now))

  return {
    fresh: eligible.filter((context) => isFreshRun(context.activity, now)),
    rest: eligible.filter((context) => !isFreshRun(context.activity, now)),
    outstanding: outstanding.length,
    eligible: eligible.length,
  }
}

/**
 * Generates and stores one batch of verdicts, appending each headline it writes
 * to `written` so the next prompt - in this batch or the one after it - can be
 * told what it must not say again.
 */
async function writeVerdicts(spender: Spender, pending: RunVerdictContext[], written: string[]) {
  const before = written.length
  const failures: string[] = []

  for (const context of pending) {
    // One call covers every daily ceiling in the pool, the per-minute spacing
    // and the time left in this invocation. What it refuses, the next run picks
    // up - and with four models to draw from, it refuses far later than one.
    const model = await spender.reserve(MODEL_POOL)
    if (!model) {
      failures.push(`${context.activity.id}: ${noReserveReason(spender)}`)
      break
    }

    const result = await generateInsight({
      model,
      systemInstruction: RUN_VERDICT_SYSTEM_INSTRUCTION,
      prompt: runVerdictInsightPrompt(context, written),
      limits: RUN_VERDICT_LIMITS,
    })
    if (!result.ok) {
      failures.push(`${context.activity.id} (${model}): ${result.reason}`)
      // Only this model is done, not the batch: the next reserve moves on to
      // the next model in the pool.
      if (isModelClosed(result.reason)) spender.exhaust(model)
      continue
    }

    await saveCachedInsight(
      runVerdictSurface(context.activity.id),
      result.insight,
      runVerdictInsightHash(context),
      null
    )
    revalidatePath(`/activities/${context.activity.id}`)
    written.push(result.insight.headline)
  }

  return { generated: written.length - before, failures }
}
