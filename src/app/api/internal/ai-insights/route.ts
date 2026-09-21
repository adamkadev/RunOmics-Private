import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { handleInternalRoute } from '@/lib/internalRoute'
import { getTrainingStatus } from '@/application/usecases/GetTrainingStatus'
import { getRunVerdictContexts } from '@/application/usecases/GetRunVerdictInsight'
import { getAnalyticsData } from '@/application/usecases/GetAnalyticsData'
import { getYearComparison } from '@/application/usecases/GetYearComparison'
import { getSeasonHeadline } from '@/application/usecases/GetSeasonHeadline'
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
import { buildTodayContext, todayInsightSession } from '@/application/usecases/GetTodayInsight'
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
  repeatsEarlierVerdict,
  runVerdictInsightHash,
  runVerdictInsightPrompt,
  runVerdictSurface,
  verdictLines,
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
  readVerdictPhrasing,
  saveCachedInsight,
  saveVerdictPhrasing,
  type VerdictPhrasing,
} from '@/infrastructure/repositories/FirestoreInsightsRepository'
import { BACKFILL_POOL, MODEL_POOL, dailyBudget, spendField } from '@/domain/ai/budget'
import { openSpender, type Spender } from '@/lib/aiSpend'
import { generateInsight, type Insight, type InsightRequest } from '@/lib/gemini'
import { sendPushToAllDevices } from '@/lib/sendPushNotification'

export const maxDuration = 300

const DEFAULT_RUN_VERDICTS_PER_RUN = 24
const MAX_RUN_VERDICTS_PER_RUN = 60

const FRESH_RUN_VERDICTS_PER_RUN = 3

const MAX_ATTEMPTS_PER_SURFACE = 3

interface SurfaceJob {
  surface: string
  limits: Limits
  systemInstruction: string
  hash: string
  guard?: string
  prompt: (recentHeadlines: string[]) => string
  bulletCount?: number
  paths: string[]
}

interface SurfaceOutcome {
  generated: boolean
  reason?: string
}

function isModelClosed(reason: string): boolean {
  return reason.startsWith('http 429') || reason.startsWith('http 404')
}

function isTransient(reason: string): boolean {
  return reason.startsWith('http 500') || reason.startsWith('http 503')
}

export function shouldTryAnotherModel(reason: string): boolean {
  return isModelClosed(reason) || isTransient(reason)
}

function noReserveReason(spender: Spender, pool: string[]): string {
  const spent = spender.report()
  const budgetSpent = pool.every((model) => (spent[spendField(model)] ?? 0) >= dailyBudget(model))
  return budgetSpent ? 'no budget left' : 'no time left in this invocation'
}

type PoolAttempt =
  | { ok: true; model: string; insight: Insight }
  | { ok: false; reason: string; reserved: boolean }

async function generateFromPool(
  spender: Spender,
  pool: string[],
  request: Omit<InsightRequest, 'model'>
): Promise<PoolAttempt> {
  const attempts: string[] = []

  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_SURFACE; attempt += 1) {
    const model = await spender.reserve(pool)
    if (!model) {
      attempts.push(noReserveReason(spender, pool))
      return { ok: false, reason: attempts.join(' | '), reserved: false }
    }

    const result = await generateInsight({ ...request, model })
    if (result.ok) return { ok: true, model, insight: result.insight }

    attempts.push(`${model}: ${result.reason}`)
    if (isModelClosed(result.reason)) spender.exhaust(model)
    if (!shouldTryAnotherModel(result.reason)) break
  }

  return { ok: false, reason: attempts.join(' | '), reserved: true }
}

async function runSurface(spender: Spender, job: SurfaceJob): Promise<SurfaceOutcome> {
  const cached = await getCachedInsight(job.surface)
  if (cached?.hash === job.hash) return { generated: false, reason: 'unchanged' }

  const attempt = await generateFromPool(spender, MODEL_POOL, {
    systemInstruction: job.systemInstruction,
    prompt: job.prompt(cached?.recentHeadlines ?? []),
    limits: job.limits,
    ...(job.bulletCount === undefined ? {} : { bulletCount: job.bulletCount }),
  })
  if (!attempt.ok) return { generated: false, reason: attempt.reason }

  await saveCachedInsight(job.surface, attempt.insight, job.hash, cached, job.guard)
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
    const phrasing = await readVerdictPhrasing()

    const written: Insight[] = []

    const fresh = limit === 0 ? [] : queue.fresh.slice(0, FRESH_RUN_VERDICTS_PER_RUN)

    const freshVerdicts = await writeVerdicts(spender, fresh, written, phrasing, MODEL_POOL, true)
    const today = await generateToday(spender)
    const weekPurpose = await generateWeekPurpose(spender)
    const season = await generateSeason(spender)
    const analyticsTabs = await generateAnalyticsTabs(spender)
    const pbCelebration = await generatePbCelebration(spender)
    const shoeVerdicts = await generateShoeVerdicts(spender)
    const backfill = await writeVerdicts(
      spender,
      [...queue.fresh.slice(fresh.length), ...queue.rest].slice(0, limit),
      written,
      phrasing,
      BACKFILL_POOL
    )

    if (written.length) {
      await saveVerdictPhrasing([...written, ...phrasing].map(({ headline, body }) => ({ headline, body })))
    }

    return NextResponse.json({
      freshVerdicts,
      today,
      weekPurpose,
      season,
      analyticsTabs,
      pbCelebration,
      shoeVerdicts,
      runVerdicts: {
        outstanding: queue.outstanding,
        eligible: queue.eligible,
        fresh: queue.fresh.length,
        rest: queue.rest.length,
        ...backfill,
      },
      spend: spender.report(),
    })
  })
}

export function requestedLimit(req: NextRequest): number {
  const param = req.nextUrl.searchParams.get('limit')
  if (param === null) return DEFAULT_RUN_VERDICTS_PER_RUN

  const raw = Number(param)
  if (!Number.isInteger(raw) || raw < 0) return DEFAULT_RUN_VERDICTS_PER_RUN
  return Math.min(raw, MAX_RUN_VERDICTS_PER_RUN)
}

function ignoresHorizon(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('all') === '1'
}

async function generateToday(spender: Spender) {
  const status = await getTrainingStatus()
  if (!status) return { generated: false, reason: 'no training status' }

  const context = buildTodayContext(status, await todayInsightSession())

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
  fresh: RunVerdictContext[]
  rest: RunVerdictContext[]
  outstanding: number
  eligible: number
}

async function runVerdictQueue(ignoreHorizon: boolean): Promise<VerdictQueue> {
  const cachedHashes = await listCachedHashes(RUN_VERDICT_PREFIX)
  const recorded = new Set(Object.keys(getQualifiedEffortsByActivityId(await getRecords())))
  const now = new Date()

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

async function writeVerdicts(
  spender: Spender,
  pending: RunVerdictContext[],
  written: Insight[],
  phrasing: VerdictPhrasing[],
  pool: string[],
  notify = false
) {
  const before = written.length
  const failures: string[] = []

  for (const context of pending) {
    const avoid = [...written, ...phrasing]
    const attempt = await generateFromPool(spender, pool, {
      systemInstruction: RUN_VERDICT_SYSTEM_INSTRUCTION,
      prompt: runVerdictInsightPrompt(context, verdictLines(avoid)),
      limits: RUN_VERDICT_LIMITS,
    })
    if (!attempt.ok) {
      failures.push(`${context.activity.id}: ${attempt.reason}`)
      if (!attempt.reserved) break
      continue
    }
    if (repeatsEarlierVerdict(attempt.insight, avoid)) {
      failures.push(`${context.activity.id} (${attempt.model}): repeated the headline "${attempt.insight.headline}"`)
      continue
    }

    await saveCachedInsight(
      runVerdictSurface(context.activity.id),
      attempt.insight,
      runVerdictInsightHash(context),
      null
    )
    revalidatePath(`/activities/${context.activity.id}`)
    written.push(attempt.insight)
    if (notify) await notifyFreshVerdict(attempt.insight)
  }

  return { generated: written.length - before, failures }
}

/**
 * The push for a run that just got its AI verdict - the payoff the ~5-minute
 * sync-to-verdict wait exists for, sent the moment it lands rather than
 * making the shortcut or the Settings card the only way to find out.
 *
 * Only `writeVerdicts(..., true)` ever calls this, and that's only the fresh
 * pass: the backfill pass covers runs up to 90 days old, and a push about one
 * of those in the middle of the night would be noise, not news.
 *
 * A push failure must never fail the sync it is reporting on - the verdict is
 * already saved and the activity page already has it either way.
 */
export async function notifyFreshVerdict(insight: Insight): Promise<void> {
  try {
    await sendPushToAllDevices(insight.headline, insight.body)
  } catch (error) {
    console.error('[ai-insights] push notification failed', error)
  }
}
