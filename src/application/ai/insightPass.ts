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
  runVerdictKind,
  runVerdictNoteKey,
  runVerdictSurface,
  verdictLines,
  type RunVerdictContext,
} from '@/domain/ai/runVerdictInsight'
import type * as InsightsRepository from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { CachedKeys, VerdictPhrasing } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Spender } from '@/application/ai/aiSpend'
import type { Insight, InsightRequest, InsightResult } from '@/lib/gemini'
import type { InsightSurfaces, SurfaceJob, SurfacePlan } from './surfaces'

export interface InsightPassDeps {
  spender: Spender
  insights: Pick<
    typeof InsightsRepository,
    'getCachedInsight' | 'saveCachedInsight' | 'listCachedKeys' | 'readVerdictPhrasing' | 'saveVerdictPhrasing'
  >
  generate: (request: InsightRequest) => Promise<InsightResult>
  revalidate: (path: string) => void
  notify: (insight: Insight, activityId: string) => Promise<unknown>
  now: () => Date
}

export interface InsightPassOptions {
  /** Run verdicts to write this pass; 0 reports the backlog without spending anything. */
  limit: number
  /** Queue every outstanding run, not only the recent ones and the record holders. */
  ignoreHorizon: boolean
}

/** Fresh runs are written before any other surface, or the quota or the clock drops them first; three is never a backfill. */
const FRESH_RUN_VERDICTS_PER_RUN = 3

const MAX_ATTEMPTS_PER_SURFACE = 3

/** Every earlier verdict is still checked for a repeat, but a much longer list leaves the model no wording at all. */
const AVOID_VERDICTS_SHOWN = 8

/** Of those, the latest of the same kind: newest first alone, a backfilled threshold session would see only the easy runs around it. */
const SAME_KIND_SHOWN = 5

export function verdictsToShow(kind: string, avoid: VerdictPhrasing[]): VerdictPhrasing[] {
  const same = avoid.filter((verdict) => verdict.kind === kind).slice(0, SAME_KIND_SHOWN)
  const others = avoid.filter((verdict) => !same.includes(verdict)).slice(0, AVOID_VERDICTS_SHOWN - same.length)
  return [...same, ...others]
}

function isModelClosed(reason: string): boolean {
  return reason.startsWith('http 429') || reason.startsWith('http 404')
}

/** A call that ran out its time is the same luck as a 503, so the next model gets asked. */
function isTransient(reason: string): boolean {
  return reason.startsWith('http 500') || reason.startsWith('http 503') || reason.startsWith('TimeoutError')
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
 * Copy the validator rejected is not retried: another model would only buy the same odds.
 * `reserved: false` means the spender refused outright, the only failure that should stop a caller looping.
 */
export async function generateFromPool(
  deps: InsightPassDeps,
  pool: string[],
  request: Omit<InsightRequest, 'model'>
): Promise<PoolAttempt> {
  const attempts: string[] = []
  const tried = new Set<string>()

  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_SURFACE; attempt += 1) {
    const untried = pool.filter((model) => !tried.has(model))
    if (!untried.length) break
    const model = await deps.spender.reserve(untried)
    if (!model) {
      attempts.push(noReserveReason(deps.spender, untried))
      // Only the untried models were refused; the tried ones may still answer the next item.
      return { ok: false, reason: attempts.join(' | '), reserved: tried.size > 0 }
    }
    // A model the pool does not name is an override standing in for all of it: one model, one chance.
    for (const asked of pool.includes(model) ? [model] : pool) tried.add(asked)

    const result = await deps.generate({ ...request, model })
    if (result.ok) return { ok: true, model, insight: result.insight }

    attempts.push(`${model}: ${result.reason}`)
    if (isModelClosed(result.reason)) deps.spender.exhaust(model, result.reason)
    if (!shouldTryAnotherModel(result.reason)) break
  }

  return { ok: false, reason: attempts.join(' | '), reserved: true }
}

interface SurfaceOutcome {
  generated: boolean
  reason?: string
  missed?: boolean
}

export async function runSurface(deps: InsightPassDeps, job: SurfaceJob): Promise<SurfaceOutcome> {
  const cached = await deps.insights.getCachedInsight(job.surface)
  if (cached?.hash === job.hash) return { generated: false, reason: 'unchanged' }

  const attempt = await generateFromPool(deps, MODEL_POOL, {
    systemInstruction: job.systemInstruction,
    prompt: job.prompt(cached?.recentHeadlines ?? []),
    limits: job.limits,
  })
  if (!attempt.ok) return { generated: false, reason: attempt.reason, missed: true }

  await deps.insights.saveCachedInsight(job.surface, attempt.insight, job.hash, cached, job.guard)
  job.paths.forEach((path) => deps.revalidate(path))
  return { generated: true }
}

interface Tally {
  missed: number
}

async function runPlan(deps: InsightPassDeps, plan: SurfacePlan, tally: Tally): Promise<SurfaceOutcome> {
  if (typeof plan === 'string') return { generated: false, reason: plan }
  const { missed, ...outcome } = await runSurface(deps, plan)
  if (missed) tally.missed += 1
  return outcome
}

async function runPlans(deps: InsightPassDeps, plans: Record<string, SurfacePlan>, tally: Tally): Promise<Record<string, string>> {
  const results: Record<string, string> = {}

  for (const [key, plan] of Object.entries(plans)) {
    const outcome = await runPlan(deps, plan, tally)
    results[key] = outcome.generated ? 'generated' : (outcome.reason ?? 'skipped')
  }

  return results
}

const CLOSED_REASON_CHARS = 120

/** The models Google closed during the pass, each with what it answered, kept for the pass's status. */
function trackClosedModels(deps: InsightPassDeps) {
  const closed = new Map<string, string>()
  const spender: Spender = {
    reserve: (pool) => deps.spender.reserve(pool),
    exhaust: (model, reason) => {
      closed.set(model, reason.slice(0, CLOSED_REASON_CHARS))
      deps.spender.exhaust(model, reason)
    },
    report: () => deps.spender.report(),
  }
  return { deps: { ...deps, spender }, closed: () => [...closed].map(([model, reason]) => ({ model, reason })) }
}

export interface VerdictQueue {
  fresh: RunVerdictContext[]
  rest: RunVerdictContext[]
  outstanding: number
  eligible: number
}

/** A verdict stored before notes were kept counts as written without one, so only runs that have a note go again. */
export function verdictQueue(
  source: { contexts: RunVerdictContext[]; recordActivityIds: ReadonlySet<string> },
  cached: ReadonlyMap<string, CachedKeys>,
  now: Date,
  ignoreHorizon: boolean
): VerdictQueue {
  const outstanding = source.contexts.filter((context) => {
    const stored = cached.get(runVerdictSurface(context.activity.id))
    if (stored?.hash !== runVerdictInsightHash(context)) return true
    return context.note !== undefined && (stored.noteKey ?? '') !== runVerdictNoteKey(context.note)
  })
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

/** `written` spans both calls of a pass and `phrasing` the passes before, so the repeat check never starts from nothing. */
export async function writeVerdicts(
  deps: InsightPassDeps,
  pending: RunVerdictContext[],
  written: VerdictPhrasing[],
  phrasing: VerdictPhrasing[],
  pool: string[],
  notifyIds: ReadonlySet<string> = new Set()
) {
  const before = written.length
  const failures: string[] = []

  for (const context of pending) {
    const avoid = [...written].reverse().concat(phrasing)
    const kind = runVerdictKind(context)
    const shown = verdictsToShow(kind, avoid)
    const attempt = await generateFromPool(deps, pool, {
      systemInstruction: RUN_VERDICT_SYSTEM_INSTRUCTION,
      prompt: runVerdictInsightPrompt(context, verdictLines(shown)),
      limits: RUN_VERDICT_LIMITS,
    })
    if (!attempt.ok) {
      failures.push(`${context.activity.id}: ${attempt.reason}`)
      if (!attempt.reserved) break
      continue
    }
    if (repeatsEarlierVerdict(attempt.insight, avoid, shown)) {
      failures.push(`${context.activity.id} (${attempt.model}): repeated the headline "${attempt.insight.headline}"`)
      continue
    }

    await deps.insights.saveCachedInsight(
      runVerdictSurface(context.activity.id),
      attempt.insight,
      runVerdictInsightHash(context),
      null,
      undefined,
      context.note === undefined ? undefined : runVerdictNoteKey(context.note)
    )
    deps.revalidate(`/activities/${context.activity.id}`)
    written.push({ headline: attempt.insight.headline, body: attempt.insight.body, kind })
    if (notifyIds.has(context.activity.id)) await notifyFreshVerdict(deps, attempt.insight, context.activity.id)
  }

  return { generated: written.length - before, failures }
}

/** A push failure must never fail the pass: the verdict is already saved. */
async function notifyFreshVerdict(deps: InsightPassDeps, insight: Insight, activityId: string): Promise<void> {
  try {
    await deps.notify(insight, activityId)
  } catch (error) {
    console.error('[ai-insights] push notification failed', error)
  }
}

/** Priority order: fresh verdicts, the displayed cards, then the backlog; what the clock or quota cuts off, the next pass picks up. */
export async function runInsightPass(passDeps: InsightPassDeps, surfaces: InsightSurfaces, options: InsightPassOptions) {
  const { deps, closed } = trackClosedModels(passDeps)
  const tally: Tally = { missed: 0 }
  const cached = await deps.insights.listCachedKeys(RUN_VERDICT_PREFIX)
  const queue = verdictQueue(await surfaces.runVerdicts(), cached, deps.now(), options.ignoreHorizon)
  const phrasing = await deps.insights.readVerdictPhrasing()

  const written: VerdictPhrasing[] = []

  const fresh = options.limit === 0 ? [] : queue.fresh.slice(0, FRESH_RUN_VERDICTS_PER_RUN)

  // A verdict written again after a prompt change or a new note is not worth a second push.
  const firstVerdicts = new Set(fresh.filter((c) => !cached.has(runVerdictSurface(c.activity.id))).map((c) => c.activity.id))
  const freshVerdicts = await writeVerdicts(deps, fresh, written, phrasing, MODEL_POOL, firstVerdicts)
  const today = await runPlan(deps, await surfaces.today(), tally)
  const pbCelebration = await runPlan(deps, await surfaces.pbCelebration(deps.now()), tally)
  const shoeVerdicts = await runPlans(deps, surfaces.shoeVerdicts(), tally)
  const backfill = await writeVerdicts(
    deps,
    [...queue.fresh.slice(fresh.length), ...queue.rest].slice(0, options.limit),
    written,
    phrasing,
    BACKFILL_POOL
  )

  if (written.length) {
    await deps.insights.saveVerdictPhrasing([...written, ...phrasing].map(({ headline, body, kind }) => ({ headline, body, ...(kind && { kind }) })))
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
    missed: tally.missed + freshVerdicts.failures.length + backfill.failures.length,
    closedModels: closed(),
    spend: deps.spender.report(),
  }
}
