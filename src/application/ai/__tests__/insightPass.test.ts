import { afterEach, describe, expect, it, vi } from 'vitest'
import { BACKFILL_POOL, MODEL_POOL, dailyBudget, spendField } from '@/domain/ai/budget'
import { runHistory } from '@/domain/activity/runHistory'
import { runVerdictInsightHash, runVerdictNoteKey, runVerdictSurface, type RunVerdictContext } from '@/domain/ai/runVerdictInsight'
import type { Activity } from '@/domain/activity/types'
import type { CachedInsight, CachedKeys, VerdictPhrasing } from '@/infrastructure/repositories/FirestoreInsightsRepository'
import type { Spender } from '@/lib/aiSpend'
import type { InsightRequest, InsightResult } from '@/lib/gemini'
import {
  generateFromPool,
  runInsightPass,
  runSurface,
  shouldTryAnotherModel,
  verdictQueue,
  verdictsToShow,
  writeVerdicts,
  type InsightPassDeps,
} from '../insightPass'
import type { InsightSurfaces, SurfaceJob } from '../surfaces'

const NOW = new Date('2026-09-24T12:00:00')
const [BEST, SECOND] = MODEL_POOL as [string, string]

afterEach(() => {
  vi.restoreAllMocks()
})

/** The real spender minus the pacing; running out of `reservations` stands for the invocation's clock being spent. */
function fakeSpender({ reservations = Infinity, spent = {} as Record<string, number> } = {}) {
  const ledger = { ...spent }
  const exhausted: string[] = []
  let left = reservations

  const spender: Spender = {
    async reserve(pool) {
      const model = pool.find((m) => !exhausted.includes(m) && (ledger[spendField(m)] ?? 0) < dailyBudget(m))
      if (!model || left <= 0) return null
      left -= 1
      ledger[spendField(model)] = (ledger[spendField(model)] ?? 0) + 1
      return model
    },
    exhaust(model) {
      exhausted.push(model)
    },
    report() {
      return { ...ledger }
    },
  }
  return { spender, exhausted }
}

function memoryInsights(stored: Record<string, Partial<CachedInsight>> = {}, phrasing: VerdictPhrasing[] = []) {
  const docs = new Map<string, CachedInsight>(
    Object.entries(stored).map(([surface, doc]) => [
      surface,
      { headline: 'Stored', body: 'Stored body.', hash: 'stored-hash', generatedAt: NOW.toISOString(), ...doc },
    ])
  )
  const saved: { surface: string; headline: string; hash: string; previous: CachedInsight | null; guard?: string; noteKey?: string }[] = []
  const savedPhrasing: VerdictPhrasing[][] = []

  const insights: InsightPassDeps['insights'] = {
    getCachedInsight: async (surface) => docs.get(surface) ?? null,
    saveCachedInsight: async (surface, insight, hash, previous, guard, noteKey) => {
      saved.push({ surface, headline: insight.headline, hash, previous, ...(guard !== undefined && { guard }), ...(noteKey !== undefined && { noteKey }) })
      docs.set(surface, { ...insight, hash, generatedAt: NOW.toISOString(), ...(noteKey !== undefined && { noteKey }) })
    },
    listCachedKeys: async (prefix: string) =>
      new Map(
        [...docs]
          .filter(([surface]) => surface.startsWith(prefix))
          .map(([surface, doc]) => [surface, { hash: doc.hash, ...(doc.noteKey !== undefined && { noteKey: doc.noteKey }) }])
      ),
    readVerdictPhrasing: async () => phrasing,
    saveVerdictPhrasing: async (recent) => {
      savedPhrasing.push(recent)
    },
  }
  return { insights, saved, savedPhrasing }
}

const ok = (headline: string, body = `${headline}, and why.`): InsightResult => ({ ok: true, insight: { headline, body } })
const fail = (reason: string): InsightResult => ({ ok: false, reason })

/** A different headline every call, so nothing trips the repeated-headline check by accident. */
function writer() {
  let count = 0
  return vi.fn<(request: InsightRequest) => Promise<InsightResult>>(async () => ok(`Verdict ${++count}`))
}

function deps(overrides: Partial<InsightPassDeps> = {}): InsightPassDeps {
  return {
    spender: fakeSpender().spender,
    insights: memoryInsights().insights,
    generate: writer(),
    revalidate: vi.fn(),
    notify: vi.fn(async () => {}),
    now: () => NOW,
    ...overrides,
  }
}

function job(surface: string, overrides: Partial<SurfaceJob> = {}): SurfaceJob {
  return {
    surface,
    limits: { headline: 60, body: 150 },
    systemInstruction: `system for ${surface}`,
    hash: `${surface}-hash`,
    prompt: (recent) => [`prompt for ${surface}`, ...recent].join('\n'),
    paths: [`/${surface}`],
    ...overrides,
  }
}

function run(id: string, date: string): RunVerdictContext {
  const activity = {
    id,
    date,
    type: 'Base',
    distanceKm: 10,
    durationSeconds: 55 * 60,
    paceSecPerKm: 330,
    avgHeartRate: 148,
    rpe: null,
    aerTrainingEffect: null,
    elevationGain: null,
    avgTemperature: 20,
    weather: null,
    hrZones: [],
    hrSamples: null,
    paceSamples: null,
    splits: null,
  } as unknown as Activity
  return { activity, history: runHistory(activity, []), planned: null }
}

const JUST_RUN = run('just-run', '2026-09-23')
const LAST_MONTH = run('last-month', '2026-09-01')
const LONG_AGO = run('long-ago', '2026-04-01')

function surfaces(overrides: Partial<InsightSurfaces> = {}): InsightSurfaces {
  return {
    runVerdicts: async () => ({ contexts: [], recordActivityIds: new Set<string>() }),
    today: async () => 'no training status',
    pbCelebration: async () => 'no fresh record',
    shoeVerdicts: () => ({}),
    ...overrides,
  }
}

describe('shouldTryAnotherModel', () => {
  it('moves on from a model that answered 429 or 404, as the pool exists for', () => {
    expect(shouldTryAnotherModel('http 429: quota exceeded')).toBe(true)
    expect(shouldTryAnotherModel('http 404: model not found')).toBe(true)
  })

  it('retries the Google-side congestion that wasted whole passes', () => {
    expect(shouldTryAnotherModel('http 503: This model is currently experiencing high demand.')).toBe(true)
    expect(shouldTryAnotherModel('http 500: internal')).toBe(true)
  })

  it('moves on from a call that ran out its time', () => {
    expect(shouldTryAnotherModel('TimeoutError: TimeoutError: The operation was aborted due to timeout')).toBe(true)
  })

  it('does not burn another model on copy the validator rejected', () => {
    expect(shouldTryAnotherModel('headline 61 > 56 chars')).toBe(false)
    expect(shouldTryAnotherModel('headline or body missing')).toBe(false)
    expect(shouldTryAnotherModel('3 bullets, expected 2')).toBe(false)
  })

  it('does not retry a request the API rejected outright', () => {
    expect(shouldTryAnotherModel('http 400: invalid argument')).toBe(false)
    expect(shouldTryAnotherModel('http 403: permission denied')).toBe(false)
  })
})

describe('generateFromPool', () => {
  const REQUEST = { systemInstruction: 'sys', prompt: 'prompt', limits: { headline: 60, body: 150 } }

  it('hands the same request to the next model once one has closed for the day', async () => {
    const { spender, exhausted } = fakeSpender()
    const generate = vi.fn().mockResolvedValueOnce(fail('http 429: quota')).mockResolvedValueOnce(ok('Fresh legs'))

    const attempt = await generateFromPool(deps({ spender, generate }), MODEL_POOL, REQUEST)

    expect(attempt).toEqual({ ok: true, model: SECOND, insight: { headline: 'Fresh legs', body: 'Fresh legs, and why.' } })
    expect(exhausted).toEqual([BEST])
    expect(generate.mock.calls.map(([request]) => [request.model, request.prompt])).toEqual([
      [BEST, 'prompt'],
      [SECOND, 'prompt'],
    ])
  })

  it('tries again after a transient error, without closing the model for the day', async () => {
    const { spender, exhausted } = fakeSpender()
    const generate = vi.fn().mockResolvedValueOnce(fail('http 503: high demand')).mockResolvedValueOnce(ok('Fresh legs'))

    const attempt = await generateFromPool(deps({ spender, generate }), MODEL_POOL, REQUEST)

    expect(attempt.ok).toBe(true)
    expect(generate).toHaveBeenCalledTimes(2)
    expect(exhausted).toEqual([])
  })

  it('does not spend another request on copy the validator rejected', async () => {
    const generate = vi.fn().mockResolvedValue(fail('headline 61 > 56 chars'))

    const attempt = await generateFromPool(deps({ generate }), MODEL_POOL, REQUEST)

    expect(attempt).toEqual({ ok: false, reason: `${BEST}: headline 61 > 56 chars`, reserved: true })
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('asks each model once, three at most, then gives up naming each', async () => {
    const generate = vi.fn().mockResolvedValue(fail('http 503: busy'))

    const attempt = await generateFromPool(deps({ generate }), MODEL_POOL, REQUEST)

    const asked = MODEL_POOL.slice(0, 3)
    expect(generate.mock.calls.map(([request]) => request.model)).toEqual(asked)
    expect(attempt).toEqual({ ok: false, reason: asked.map((model) => `${model}: http 503: busy`).join(' | '), reserved: true })
  })

  it('never asks one model twice for the same item, however short the pool', async () => {
    const generate = vi.fn().mockResolvedValue(fail('http 503: busy'))

    await generateFromPool(deps({ generate }), [BEST, SECOND], REQUEST)

    expect(generate.mock.calls.map(([request]) => request.model)).toEqual([BEST, SECOND])
  })

  it('gives a GEMINI_MODEL override, one model for the whole pool, one chance', async () => {
    const { spender } = fakeSpender()
    const override: Spender = { ...spender, reserve: async () => 'gemini-override' }
    const generate = vi.fn().mockResolvedValue(fail('http 503: busy'))

    await generateFromPool(deps({ spender: override, generate }), MODEL_POOL, REQUEST)

    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('lets the caller go on when only the models not yet asked are refused', async () => {
    const generate = vi.fn().mockResolvedValue(fail('http 503: busy'))

    const attempt = await generateFromPool(deps({ spender: fakeSpender({ reservations: 1 }).spender, generate }), MODEL_POOL, REQUEST)

    expect(generate).toHaveBeenCalledTimes(1)
    expect(attempt).toMatchObject({ ok: false, reserved: true })
  })

  it('reports a spender that would not reserve apart from a model that failed', async () => {
    const generate = vi.fn()

    const attempt = await generateFromPool(deps({ spender: fakeSpender({ reservations: 0 }).spender, generate }), MODEL_POOL, REQUEST)

    expect(attempt).toEqual({ ok: false, reason: 'no time left in this invocation', reserved: false })
    expect(generate).not.toHaveBeenCalled()
  })

  it('says the budget is spent, not the clock, when every model in the pool has used its day', async () => {
    const spent = Object.fromEntries(MODEL_POOL.map((model) => [spendField(model), dailyBudget(model)]))

    const attempt = await generateFromPool(deps({ spender: fakeSpender({ spent }).spender }), MODEL_POOL, REQUEST)

    expect(attempt).toEqual({ ok: false, reason: 'no budget left', reserved: false })
  })
})

describe('runSurface', () => {
  it('spends nothing when the stored card was written from the same facts', async () => {
    const store = memoryInsights({ today: { hash: 'today-hash' } })
    const generate = writer()
    const revalidate = vi.fn()

    const outcome = await runSurface(deps({ insights: store.insights, generate, revalidate }), job('today'))

    expect(outcome).toEqual({ generated: false, reason: 'unchanged' })
    expect(generate).not.toHaveBeenCalled()
    expect(store.saved).toEqual([])
    expect(revalidate).not.toHaveBeenCalled()
  })

  it('writes the card with its hash and guard, and revalidates the pages that show it', async () => {
    const store = memoryInsights({ today: { hash: 'yesterday', recentHeadlines: ['Easy does it'] } })
    const generate = writer()
    const revalidate = vi.fn()

    const outcome = await runSurface(
      deps({ insights: store.insights, generate, revalidate }),
      job('today', { guard: 'go', paths: ['/', '/analytics'] })
    )

    expect(outcome).toEqual({ generated: true })
    expect(store.saved).toEqual([
      { surface: 'today', headline: 'Verdict 1', hash: 'today-hash', previous: expect.objectContaining({ hash: 'yesterday' }), guard: 'go' },
    ])
    expect(revalidate.mock.calls).toEqual([['/'], ['/analytics']])
  })

  it('shows the model the headlines this card already used', async () => {
    const generate = writer()

    await runSurface(
      deps({ insights: memoryInsights({ today: { hash: 'old', recentHeadlines: ['Fresh legs, easy day.'] } }).insights, generate }),
      job('today')
    )

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ model: BEST, prompt: 'prompt for today\nFresh legs, easy day.' }))
  })

  it('keeps the stored card when generation fails', async () => {
    const store = memoryInsights()
    const revalidate = vi.fn()

    const outcome = await runSurface(
      deps({ insights: store.insights, generate: vi.fn().mockResolvedValue(fail('em-dash')), revalidate }),
      job('today')
    )

    expect(outcome).toEqual({ generated: false, reason: `${BEST}: em-dash` })
    expect(store.saved).toEqual([])
    expect(revalidate).not.toHaveBeenCalled()
  })
})

describe('verdictQueue', () => {
  const noRecords = new Set<string>()

  it('queues only the runs whose stored verdict is missing or was written from other facts', () => {
    const current = run('current', '2026-09-20')
    const stale = run('stale', '2026-09-21')
    const hashes = new Map([
      [runVerdictSurface('current'), { hash: runVerdictInsightHash(current) }],
      [runVerdictSurface('stale'), { hash: 'facts-before-a-reprocess' }],
    ])

    const queue = verdictQueue({ contexts: [current, stale, JUST_RUN], recordActivityIds: noRecords }, hashes, NOW, false)

    expect([...queue.fresh, ...queue.rest].map((c) => c.activity.id).sort()).toEqual(['just-run', 'stale'])
    expect(queue.outstanding).toBe(2)
  })

  it('queues a run again once its note changes, and only then', () => {
    const noted = { ...LAST_MONTH, note: { note: 'sick', tags: [] } }
    const plain = { ...JUST_RUN, note: null }
    const stored = new Map<string, CachedKeys>([
      [runVerdictSurface('last-month'), { hash: runVerdictInsightHash(noted) }],
      [runVerdictSurface('just-run'), { hash: runVerdictInsightHash(plain) }],
    ])

    expect(verdictQueue({ contexts: [noted, plain], recordActivityIds: noRecords }, stored, NOW, false).outstanding).toBe(1)
    const written = new Map<string, CachedKeys>([...stored, [runVerdictSurface('last-month'), { hash: runVerdictInsightHash(noted), noteKey: runVerdictNoteKey(noted.note) }]])
    expect(verdictQueue({ contexts: [noted, plain], recordActivityIds: noRecords }, written, NOW, false).outstanding).toBe(0)
    // A pass that could not read the notes never takes that for "no note".
    const unread = { ...LAST_MONTH, note: undefined }
    expect(verdictQueue({ contexts: [unread], recordActivityIds: noRecords }, written, NOW, false).outstanding).toBe(0)
  })

  it('leaves a run past the horizon out, unless it holds a record or the horizon is lifted', () => {
    const contexts = [LONG_AGO]

    expect(verdictQueue({ contexts, recordActivityIds: noRecords }, new Map(), NOW, false).eligible).toBe(0)
    expect(verdictQueue({ contexts, recordActivityIds: new Set(['long-ago']) }, new Map(), NOW, false).eligible).toBe(1)
    expect(verdictQueue({ contexts, recordActivityIds: noRecords }, new Map(), NOW, true).eligible).toBe(1)
  })

  it('splits the runs that just landed from the backlog', () => {
    const queue = verdictQueue({ contexts: [JUST_RUN, LAST_MONTH, LONG_AGO], recordActivityIds: noRecords }, new Map(), NOW, false)

    expect(queue.fresh.map((c) => c.activity.id)).toEqual(['just-run'])
    expect(queue.rest.map((c) => c.activity.id)).toEqual(['last-month'])
    expect(queue).toMatchObject({ outstanding: 3, eligible: 2 })
  })
})

describe('writeVerdicts', () => {
  it('saves each verdict under its run, keyed on its facts, and pushes it when asked', async () => {
    const store = memoryInsights()
    const notify = vi.fn(async () => {})
    const revalidate = vi.fn()

    const result = await writeVerdicts(deps({ insights: store.insights, notify, revalidate }), [JUST_RUN], [], [], MODEL_POOL, new Set(['just-run']))

    expect(result).toEqual({ generated: 1, failures: [] })
    expect(store.saved).toEqual([
      { surface: runVerdictSurface('just-run'), headline: 'Verdict 1', hash: runVerdictInsightHash(JUST_RUN), previous: null },
    ])
    expect(revalidate).toHaveBeenCalledWith('/activities/just-run')
    expect(notify).toHaveBeenCalledWith({ headline: 'Verdict 1', body: 'Verdict 1, and why.' })
  })

  it('never pushes a backfilled verdict', async () => {
    const notify = vi.fn(async () => {})

    await writeVerdicts(deps({ notify }), [LAST_MONTH], [], [], BACKFILL_POOL)

    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects a headline this pass or an earlier one already used, and leaves the run queued', async () => {
    const store = memoryInsights()
    const generate = vi.fn().mockResolvedValue(ok('Held together.'))
    const phrasing = [{ headline: 'held together', body: 'An earlier night.' }]

    const result = await writeVerdicts(deps({ insights: store.insights, generate }), [JUST_RUN], [], phrasing, MODEL_POOL, new Set(['just-run']))

    expect(result.generated).toBe(0)
    expect(result.failures).toEqual([`just-run (${BEST}): repeated the headline "Held together."`])
    expect(store.saved).toEqual([])
  })

  it('shows each verdict what the earlier ones in the pass already said', async () => {
    const generate = writer()

    await writeVerdicts(deps({ generate }), [JUST_RUN, LAST_MONTH], [], [], BACKFILL_POOL)

    expect(generate.mock.calls[1]?.[0].prompt).toContain('Verdict 1 / Verdict 1, and why.')
  })

  it('keeps writing when a push fails - the verdict is already saved', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const notify = vi.fn().mockRejectedValueOnce(new Error('FCM is down')).mockResolvedValue(undefined)

    const result = await writeVerdicts(deps({ notify }), [JUST_RUN, run('same-week', '2026-09-22')], [], [], MODEL_POOL, new Set(['just-run', 'same-week']))

    expect(result).toEqual({ generated: 2, failures: [] })
    expect(notify).toHaveBeenCalledTimes(2)
    expect(errors).toHaveBeenCalledWith('[ai-insights] push notification failed', expect.any(Error))
  })

  it('moves on past a verdict whose copy was rejected', async () => {
    const generate = vi.fn().mockResolvedValueOnce(fail('body 180 > 150 chars')).mockResolvedValueOnce(ok('Second run'))

    const result = await writeVerdicts(deps({ generate }), [JUST_RUN, LAST_MONTH], [], [], BACKFILL_POOL)

    expect(result).toEqual({ generated: 1, failures: [`just-run: ${BACKFILL_POOL[0]}: body 180 > 150 chars`] })
  })

  it('stops at the first verdict the spender has no time left for, rather than asking for each', async () => {
    const generate = writer()
    const pending = [JUST_RUN, LAST_MONTH, run('older', '2026-08-20')]

    const result = await writeVerdicts(
      deps({ spender: fakeSpender({ reservations: 1 }).spender, generate }),
      pending,
      [],
      [],
      BACKFILL_POOL
    )

    expect(result).toEqual({ generated: 1, failures: ['last-month: no time left in this invocation'] })
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('shows the model the eight newest verdicts, and still rejects a repeat of any of them', async () => {
    const generate = writer()
    const phrasing = Array.from({ length: 12 }, (_, i) => ({ headline: `Stored ${i}`, body: `Stored body ${i}.` }))
    const written = [{ headline: 'Older in this pass', body: 'x' }, { headline: 'Newest in this pass', body: 'y' }]

    await writeVerdicts(deps({ generate }), [LAST_MONTH], written, phrasing, BACKFILL_POOL)

    const prompt: string = generate.mock.calls[0]![0].prompt
    const shown = prompt.slice(prompt.indexOf(': "') + 2).split('", "')
    expect(shown).toHaveLength(8)
    expect(shown[0]).toBe('"Newest in this pass / y')
    expect(prompt).toContain('Older in this pass / x')
    expect(prompt).not.toContain('Stored 6 /')

    const repeat = vi.fn().mockResolvedValue(ok('Stored 11'))
    const result = await writeVerdicts(deps({ generate: repeat }), [LAST_MONTH], [], phrasing, BACKFILL_POOL)
    expect(result.generated).toBe(0)
  })

  it('shows the latest verdicts of the same kind of session first', async () => {
    const generate = writer()
    const easy = Array.from({ length: 10 }, (_, i) => ({ headline: `Easy ${i}`, body: 'e', kind: 'easy' }))
    const threshold = [
      { headline: 'Threshold new', body: 't', kind: 'threshold' },
      { headline: 'Threshold old', body: 't', kind: 'threshold' },
    ]
    const tempo = { ...LAST_MONTH, activity: { ...LAST_MONTH.activity, type: 'Threshold' as const } }

    await writeVerdicts(deps({ generate }), [tempo], [], [...easy.slice(0, 5), ...threshold, ...easy.slice(5)], BACKFILL_POOL)

    const prompt: string = generate.mock.calls[0]![0].prompt
    const shown = prompt.slice(prompt.indexOf(': "') + 2).split('", "')
    expect(shown).toHaveLength(8)
    expect(shown.slice(0, 2)).toEqual(['"Threshold new / t', 'Threshold old / t'])
    expect(shown[2]).toBe('Easy 0 / e')
  })
})

describe('verdictsToShow', () => {
  it('fills with the newest of other kinds once the same kind runs out, and caps the same kind at five', () => {
    const verdicts = Array.from({ length: 12 }, (_, i) => ({ headline: `H${i}`, body: 'b', kind: i % 2 ? 'easy' : 'threshold' }))

    const shown = verdictsToShow('threshold', verdicts).map((v) => v.headline)

    expect(shown).toEqual(['H0', 'H2', 'H4', 'H6', 'H8', 'H1', 'H3', 'H5'])
    expect(verdictsToShow('race', verdicts)).toHaveLength(8)
  })
})

describe('runInsightPass', () => {
  const OPTIONS = { limit: 24, ignoreHorizon: false }
  const withRuns = (...contexts: RunVerdictContext[]) => async () => ({ contexts, recordActivityIds: new Set<string>() })

  it('writes the verdict for the run that just landed first, and the backlog last', async () => {
    const store = memoryInsights()

    await runInsightPass(
      deps({ insights: store.insights }),
      surfaces({
        runVerdicts: withRuns(LAST_MONTH, JUST_RUN),
        today: async () => job('today'),
        shoeVerdicts: () => ({ pegasus: job('shoeVerdict_pegasus') }),
      }),
      OPTIONS
    )

    expect(store.saved.map((doc) => doc.surface)).toEqual([
      'runVerdict_just-run',
      'today',
      'shoeVerdict_pegasus',
      'runVerdict_last-month',
    ])
  })

  it('pushes a fresh run only for its first verdict, never for one written again', async () => {
    const notify = vi.fn(async () => {})
    const store = memoryInsights({ [runVerdictSurface('just-run')]: { hash: 'written-by-an-older-prompt' } })

    await runInsightPass(deps({ notify, insights: store.insights }), surfaces({ runVerdicts: withRuns(JUST_RUN) }), OPTIONS)

    expect(store.saved.map((doc) => doc.surface)).toEqual([runVerdictSurface('just-run')])
    expect(notify).not.toHaveBeenCalled()
  })

  it('pushes the fresh verdict and no other card', async () => {
    const notify = vi.fn(async () => {})

    await runInsightPass(
      deps({ notify }),
      surfaces({ runVerdicts: withRuns(JUST_RUN, LAST_MONTH), today: async () => job('today') }),
      OPTIONS
    )

    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith({ headline: 'Verdict 1', body: 'Verdict 1, and why.' })
  })

  it('writes the phrasing back once, newest first, as headline, body and the kind of session', async () => {
    const store = memoryInsights({}, [{ headline: 'Last night', body: 'An older verdict.' }])

    await runInsightPass(deps({ insights: store.insights }), surfaces({ runVerdicts: withRuns(JUST_RUN, LAST_MONTH) }), OPTIONS)

    expect(store.savedPhrasing).toEqual([
      [
        { headline: 'Verdict 1', body: 'Verdict 1, and why.', kind: 'easy' },
        { headline: 'Verdict 2', body: 'Verdict 2, and why.', kind: 'easy' },
        { headline: 'Last night', body: 'An older verdict.' },
      ],
    ])
  })

  it('reports the backlog without spending on it when the limit is 0', async () => {
    const store = memoryInsights()
    const generate = writer()

    const report = await runInsightPass(
      deps({ insights: store.insights, generate }),
      surfaces({ runVerdicts: withRuns(JUST_RUN, LAST_MONTH) }),
      { limit: 0, ignoreHorizon: false }
    )

    expect(generate).not.toHaveBeenCalled()
    expect(store.savedPhrasing).toEqual([])
    expect(report.runVerdicts).toEqual({ outstanding: 2, eligible: 2, fresh: 1, rest: 1, generated: 0, failures: [] })
  })

  it('says where the clock ran out, and leaves the rest for the next pass', async () => {
    const report = await runInsightPass(
      deps({ spender: fakeSpender({ reservations: 2 }).spender }),
      surfaces({
        runVerdicts: withRuns(JUST_RUN, LAST_MONTH),
        today: async () => job('today'),
        shoeVerdicts: () => ({ pegasus: job('shoeVerdict_pegasus') }),
      }),
      OPTIONS
    )

    expect(report.freshVerdicts).toEqual({ generated: 1, failures: [] })
    expect(report.today).toEqual({ generated: true })
    expect(report.shoeVerdicts).toEqual({ pegasus: 'no time left in this invocation' })
    expect(report.runVerdicts).toMatchObject({ generated: 0, failures: ['last-month: no time left in this invocation'] })
  })

  it('checks the PB celebration window against the pass clock', async () => {
    const pbCelebration = vi.fn(async () => 'no fresh record')

    const report = await runInsightPass(deps(), surfaces({ pbCelebration }), OPTIONS)

    expect(pbCelebration).toHaveBeenCalledWith(NOW)
    expect(report.pbCelebration).toEqual({ generated: false, reason: 'no fresh record' })
  })

  it('answers with the report the route has always returned, less the cards no page shows', async () => {
    const { spender } = fakeSpender()

    const report = await runInsightPass(deps({ spender }), surfaces(), OPTIONS)

    expect(report).toEqual({
      freshVerdicts: { generated: 0, failures: [] },
      today: { generated: false, reason: 'no training status' },
      pbCelebration: { generated: false, reason: 'no fresh record' },
      shoeVerdicts: {},
      runVerdicts: { outstanding: 0, eligible: 0, fresh: 0, rest: 0, generated: 0, failures: [] },
      spend: {},
    })
  })
})
