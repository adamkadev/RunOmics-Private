import { BACKFILL_POOL, MODEL_POOL, dailyBudget, spendField } from '@/domain/ai/budget'
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
import type * as InsightsRepository from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { VerdictPhrasing } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Spender } from '@/lib/aiSpend'
import type { Insight, InsightRequest, InsightResult } from '@/lib/gemini'
import type { InsightSurfaces, SurfaceJob, SurfacePlan } from './surfaces'

/**
 * Everything the pass does to the world, passed in so the loop that spends
 * the Gemini quota can be tested without Firestore, Gemini, Next or FCM. The
 * route hands over the real ones; `insights` is the Firestore repository's
 * own functions, not a second definition of them.
 */
export interface InsightPassDeps {
  spender: Spender
  insights: Pick<
    typeof InsightsRepository,
    'getCachedInsight' | 'saveCachedInsight' | 'listCachedHashes' | 'readVerdictPhrasing' | 'saveVerdictPhrasing'
  >
  generate: (request: InsightRequest) => Promise<InsightResult>
  revalidate: (path: string) => void
  notify: (insight: Insight) => Promise<void>
  now: () => Date
}

export interface InsightPassOptions {
  /** Run verdicts to write this pass; 0 reports the backlog without spending anything. */
  limit: number
  /** Queue every outstanding run, not only the recent ones and the record holders. */
  ignoreHorizon: boolean
}

/**
 * Runs from the last three days are written before any other surface: behind
 * the rest, the one insight the athlete is waiting for is the first thing the
 * quota or the clock drops. Three is a week's running, never a backfill.
 */
const FRESH_RUN_VERDICTS_PER_RUN = 3

const MAX_ATTEMPTS_PER_SURFACE = 3

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

/**
 * One request, walked across the pool: a model that is closed for the day or
 * answered with a transient error hands the same request to the next one.
 * Copy the validator rejected is not retried - another model would only buy
 * the same odds. `reserved: false` means the spender refused outright, which
 * is the only failure that should stop a caller looping.
 */
export async function generateFromPool(
  deps: InsightPassDeps,
  pool: string[],
  request: Omit<InsightRequest, 'model'>
): Promise<PoolAttempt> {
  const attempts: string[] = []

  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_SURFACE; attempt += 1) {
    const model = await deps.spender.reserve(pool)
    if (!model) {
      attempts.push(noReserveReason(deps.spender, pool))
      return { ok: false, reason: attempts.join(' | '), reserved: false }
    }

    const result = await deps.generate({ ...request, model })
    if (result.ok) return { ok: true, model, insight: result.insight }

    attempts.push(`${model}: ${result.reason}`)
    if (isModelClosed(result.reason)) deps.spender.exhaust(model)
    if (!shouldTryAnotherModel(result.reason)) break
  }

  return { ok: false, reason: attempts.join(' | '), reserved: true }
}

interface SurfaceOutcome {
  generated: boolean
  reason?: string
}

/** Writes one card, unless the stored copy was written from the same facts. */
export async function runSurface(deps: InsightPassDeps, job: SurfaceJob): Promise<SurfaceOutcome> {
  const cached = await deps.insights.getCachedInsight(job.surface)
  if (cached?.hash === job.hash) return { generated: false, reason: 'unchanged' }

  const attempt = await generateFromPool(deps, MODEL_POOL, {
    systemInstruction: job.systemInstruction,
    prompt: job.prompt(cached?.recentHeadlines ?? []),
    limits: job.limits,
  })
  if (!attempt.ok) return { generated: false, reason: attempt.reason }

  await deps.insights.saveCachedInsight(job.surface, attempt.insight, job.hash, cached, job.guard)
  job.paths.forEach((path) => deps.revalidate(path))
  return { generated: true }
}

async function runPlan(deps: InsightPassDeps, plan: SurfacePlan): Promise<SurfaceOutcome> {
  return typeof plan === 'string' ? { generated: false, reason: plan } : runSurface(deps, plan)
}

async function runPlans(deps: InsightPassDeps, plans: Record<string, SurfacePlan>): Promise<Record<string, string>> {
  const results: Record<string, string> = {}

  for (const [key, plan] of Object.entries(plans)) {
    const outcome = await runPlan(deps, plan)
    results[key] = outcome.generated ? 'generated' : (outcome.reason ?? 'skipped')
  }

  return results
}

export interface VerdictQueue {
  fresh: RunVerdictContext[]
  rest: RunVerdictContext[]
  outstanding: number
  eligible: number
}

/**
 * The runs whose stored verdict is missing or was written from other facts,
 * split into the ones that just landed and the backlog.
 */
export function verdictQueue(
  source: { contexts: RunVerdictContext[]; recordActivityIds: ReadonlySet<string> },
  cachedHashes: ReadonlyMap<string, string>,
  now: Date,
  ignoreHorizon: boolean
): VerdictQueue {
  const outstanding = source.contexts.filter(
    (context) => cachedHashes.get(runVerdictSurface(context.activity.id)) !== runVerdictInsightHash(context)
  )
  const eligible = ignoreHorizon
    ? outstanding
    : outstanding.filter((context) => deservesVerdict(context.activity, source.recordActivityIds, now))

  return {
    fresh: eligible.filter((context) => isFreshRun(context.activity, now)),
    rest: eligible.filter((context) => !isFreshRun(context.activity, now)),
    outstanding: outstanding.length,
    eligible: eligible.length,
  }
}

/**
 * `written` spans both calls of one pass and `phrasing` the passes before it,
 * so neither the avoid list nor the repeated-headline check starts from
 * nothing. A repeat is rejected, not saved: the run stays queued for the next
 * pass, as over-long copy does.
 */
export async function writeVerdicts(
  deps: InsightPassDeps,
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
    const attempt = await generateFromPool(deps, pool, {
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

    await deps.insights.saveCachedInsight(
      runVerdictSurface(context.activity.id),
      attempt.insight,
      runVerdictInsightHash(context),
      null
    )
    deps.revalidate(`/activities/${context.activity.id}`)
    written.push(attempt.insight)
    if (notify) await notifyFreshVerdict(deps, attempt.insight)
  }

  return { generated: written.length - before, failures }
}

/**
 * The push for a run that just got its AI verdict - the payoff the ~5-minute
 * sync-to-verdict wait exists for, sent the moment it lands rather than
 * making the shortcut or the Settings card the only way to find out.
 *
 * Only the fresh verdicts are pushed: the backfill covers runs up to 90 days
 * old, and a push about one of those in the middle of the night would be
 * noise, not news.
 *
 * A push failure must never fail the pass it is reporting on - the verdict is
 * already saved and the activity page already has it either way.
 */
async function notifyFreshVerdict(deps: InsightPassDeps, insight: Insight): Promise<void> {
  try {
    await deps.notify(insight)
  } catch (error) {
    console.error('[ai-insights] push notification failed', error)
  }
}

/**
 * One pass over every AI surface, in priority order: the verdicts for runs
 * that just landed, then the cards a reader looks at, then the verdict
 * backlog on the cheaper pool. What the clock or the quota cuts off here, the
 * next pass picks up - every surface is keyed on the facts it was written from.
 */
export async function runInsightPass(deps: InsightPassDeps, surfaces: InsightSurfaces, options: InsightPassOptions) {
  const queue = verdictQueue(
    await surfaces.runVerdicts(),
    await deps.insights.listCachedHashes(RUN_VERDICT_PREFIX),
    deps.now(),
    options.ignoreHorizon
  )
  const phrasing = await deps.insights.readVerdictPhrasing()

  const written: Insight[] = []

  const fresh = options.limit === 0 ? [] : queue.fresh.slice(0, FRESH_RUN_VERDICTS_PER_RUN)

  const freshVerdicts = await writeVerdicts(deps, fresh, written, phrasing, MODEL_POOL, true)
  const today = await runPlan(deps, await surfaces.today())
  const pbCelebration = await runPlan(deps, await surfaces.pbCelebration(deps.now()))
  const shoeVerdicts = await runPlans(deps, surfaces.shoeVerdicts())
  const backfill = await writeVerdicts(
    deps,
    [...queue.fresh.slice(fresh.length), ...queue.rest].slice(0, options.limit),
    written,
    phrasing,
    BACKFILL_POOL
  )

  if (written.length) {
    await deps.insights.saveVerdictPhrasing([...written, ...phrasing].map(({ headline, body }) => ({ headline, body })))
  }

  return {
    freshVerdicts,
    today,
    pbCelebration,
    shoeVerdicts,
    runVerdicts: {
      outstanding: queue.outstanding,
      eligible: queue.eligible,
      fresh: queue.fresh.length,
      rest: queue.rest.length,
      ...backfill,
    },
    spend: deps.spender.report(),
  }
}
