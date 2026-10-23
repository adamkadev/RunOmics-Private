import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCoachingContext } from '@/application/coaching/context'
import type { Activity } from '@/domain/activity/types'
import { generateInsight } from '@/lib/gemini'
import { GeminiCoachingAdvisor, pacing } from '../GeminiCoachingAdvisor'

const realSleep = pacing.sleep

const GENERAL_KEY = 'general-project-key-0001'
const COACH_KEY = 'coach-project-key-0002'

const INSIGHT_REQUEST = {
  model: 'test-model',
  systemInstruction: 'sys',
  prompt: 'prompt',
  limits: { headline: 40, body: 80 },
}

const RECOMMENDATION = {
  outcome: 'KEEP',
  reasonCodes: ['on_track'],
  summary: 'The run matched its prescription.',
  evidence: [{ code: 'pace', message: 'Pace stayed inside the easy range.' }],
  changes: [],
}

function respondWith(payload: unknown) {
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
  })
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

function keysSentTo(fetchSpy: ReturnType<typeof vi.fn>): unknown[] {
  return fetchSpy.mock.calls.map(([, init]) => (init as RequestInit).headers as Record<string, string>)
    .map((headers) => headers['x-goog-api-key'])
}

function activity(): Activity {
  return {
    id: 'run-1',
    date: '2026-09-06',
    type: 'Base',
    distanceKm: 10,
    durationSeconds: 3_000,
    paceSecPerKm: 300,
    avgHeartRate: 145,
    rpe: 4,
    splits: null,
    route: null,
    paceSamples: null,
  } as Activity
}

function context() {
  return buildCoachingContext({
    activities: [],
    plan: null,
    athlete: {},
    trainingStatus: null,
    loadBalance: null,
    trainingZones: null, trajectories: null,
    latestVo2max: null,
    racePredictions: null,
    goals: [],
    personalBests: [],
    upcomingRaces: [],
    officialResults: [],
  }, '2026-09-07')
}

function evaluate() {
  return new GeminiCoachingAdvisor().evaluateActivity({ context: context(), activity: activity(), prescription: null })
}

async function coachingFailure(): Promise<string> {
  try {
    await evaluate()
    return 'unexpectedly succeeded'
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', GENERAL_KEY)
  vi.stubEnv('GEMINI_COACH_API_KEY', COACH_KEY)
  // Real pacing spaces calls 13 seconds apart; a second call would outlast the test timeout.
  pacing.lastRequestAt = 0
  pacing.sleep = () => Promise.resolve()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  pacing.sleep = realSleep
})

describe('Gemini credential isolation', () => {
  it('bills general insights to GEMINI_API_KEY', async () => {
    const fetchSpy = respondWith({ headline: 'Fresh legs', body: 'Fatigue is down.' })

    expect(await generateInsight(INSIGHT_REQUEST)).toEqual({
      ok: true,
      insight: { headline: 'Fresh legs', body: 'Fatigue is down.' },
    })
    expect(keysSentTo(fetchSpy)).toEqual([GENERAL_KEY])
  })

  it('bills coaching to GEMINI_COACH_API_KEY', async () => {
    const fetchSpy = respondWith(RECOMMENDATION)

    expect(await evaluate()).toMatchObject({ outcome: 'KEEP', summary: RECOMMENDATION.summary })
    expect(keysSentTo(fetchSpy)).toEqual([COACH_KEY])
  })

  it('fails coaching with a coach-specific message when GEMINI_COACH_API_KEY is missing', async () => {
    vi.stubEnv('GEMINI_COACH_API_KEY', '')
    const fetchSpy = respondWith(RECOMMENDATION)

    expect(await coachingFailure()).toBe('Gemini coaching request failed: GEMINI_COACH_API_KEY is not configured')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('never falls back to the general key when only GEMINI_API_KEY is configured', async () => {
    vi.stubEnv('GEMINI_COACH_API_KEY', '')
    const fetchSpy = respondWith(RECOMMENDATION)

    expect(await coachingFailure()).toContain('GEMINI_COACH_API_KEY is not configured')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(process.env.GEMINI_API_KEY).toBe(GENERAL_KEY)
  })

  it('leaves general insights working when the coach key is missing', async () => {
    vi.stubEnv('GEMINI_COACH_API_KEY', '')
    const fetchSpy = respondWith({ headline: 'Fresh legs', body: 'Fatigue is down.' })

    expect((await generateInsight(INSIGHT_REQUEST)).ok).toBe(true)
    expect(keysSentTo(fetchSpy)).toEqual([GENERAL_KEY])
  })

  it('leaves coaching working when the general key is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    const fetchSpy = respondWith(RECOMMENDATION)

    expect(await evaluate()).toMatchObject({ outcome: 'KEEP' })
    expect(keysSentTo(fetchSpy)).toEqual([COACH_KEY])
  })

  it('keeps both keys out of the reported failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'API key not valid' }))

    const insight = await generateInsight(INSIGHT_REQUEST)
    const messages = [insight.ok ? '' : insight.reason, await coachingFailure()]

    vi.stubEnv('GEMINI_COACH_API_KEY', '')
    messages.push(await coachingFailure())

    for (const message of messages) {
      expect(message).not.toContain(GENERAL_KEY)
      expect(message).not.toContain(COACH_KEY)
    }
  })
})
