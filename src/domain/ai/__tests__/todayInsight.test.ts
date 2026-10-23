import { describe, expect, it } from 'vitest'
import { sessionKind, todayInsightGuard, todayInsightHash, todayInsightPrompt, TODAY_LIMITS, TODAY_SYSTEM_INSTRUCTION, type TodayContext } from '../todayInsight'
import { t } from '@/i18n'
import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'
import type { PlannedWorkout } from '@/domain/activity/types'

const status: TrainingStatus = {
  status: 'overreaching',
  risk: 'high',
  loadTrend: 'building',
  ctl: 58,
  atl: 62,
  tsb: -12,
  tsbNow: -14,
  acwr: 1.4,
  ctlDelta: 2.4,
  ctlDeltaShown: 1.2,
  atlDelta: 6,
  tsbDelta: -8,
  ctlPeak: 60,
  source: 'garmin',
  acwrStatus: 'HIGH',
  chronicLoad: 420,
  chronicLoadMin: 380,
  chronicLoadMax: 480,
}

const workout: PlannedWorkout = { date: '2026-08-01', name: 'Base', type: 'Base', durationSecs: 1800 }

function context(overrides: Partial<TodayContext> = {}): TodayContext {
  return {
    status,
    tone: 'hold',
    plannedWorkout: workout,
    recent: { weekRuns: 5, weekKm: 39, lastRun: { type: 'Base', daysAgo: 1, distanceKm: 5 } },
    ...overrides,
  }
}

describe('todayInsightPrompt', () => {
  it('advises approaching the session when it is still ahead', () => {
    const prompt = todayInsightPrompt(context(), [])

    expect(prompt).toContain('Fatigue is elevated. Advise keeping the run very easy, or shortening it.')
    expect(prompt).not.toContain('already been completed')
  })

  it('writes about the session in the past once it has already been run today', () => {
    const prompt = todayInsightPrompt(
      context({ recent: { weekRuns: 6, weekKm: 44, lastRun: { type: 'Base', daysAgo: 0, distanceKm: 5 } } }),
      []
    )

    expect(prompt).toContain('Acknowledge it is done and turn to what recovering from it now looks like.')
    expect(prompt).toContain('- This session has already been completed today')
    expect(prompt).not.toContain('Advise keeping the run very easy')
  })

  it('writes about a run logged today on a rest day in the past, without calling it the planned session', () => {
    const prompt = todayInsightPrompt(
      context({ plannedWorkout: null, recent: { weekRuns: 6, weekKm: 44, lastRun: { type: 'Base', daysAgo: 0, distanceKm: 5 } } }),
      []
    )

    expect(prompt).toContain('today was a rest day on the plan, and the athlete ran anyway')
    expect(prompt).not.toContain('Say rest is exactly what the body needs now.')
    expect(prompt).not.toContain('already been completed')
  })
})

describe('the week the prompt reports', () => {
  it('is the week so far from Monday, the one the dashboard ring counts, and no rolling seven days', () => {
    const prompt = todayInsightPrompt(context(), [])

    expect(prompt).toContain('- This week so far (Monday to today), in the weekly card: 5 runs, 39 km')
    expect(prompt).not.toMatch(/last 7 days/i)
  })
})

describe('todayInsightHash', () => {
  it('changes once the planned session is logged as run today, so the stale forward-looking copy is not served back', () => {
    const before = todayInsightHash(context({ recent: { weekRuns: 5, weekKm: 39, lastRun: { type: 'Base', daysAgo: 1, distanceKm: 5 } } }))
    const after = todayInsightHash(context({ recent: { weekRuns: 6, weekKm: 44, lastRun: { type: 'Base', daysAgo: 0, distanceKm: 5 } } }))

    expect(before).not.toBe(after)
  })
})

describe('the kind of day (v4.16.4)', () => {
  const garmin = (name: string, steps: PlannedWorkout['steps']): PlannedWorkout => ({ date: '2026-09-23', name, type: 'Base', steps })

  it('reads rest, race and the quality types from the plan', () => {
    expect(sessionKind(null)).toBe('rest')
    expect(sessionKind({ ...workout, type: 'Race' })).toBe('race')
    expect(sessionKind({ ...workout, type: 'Threshold' })).toBe('quality')
    expect(sessionKind(workout)).toBe('easy')
  })

  // A name the sync cannot read is stored as Base, whatever the session is.
  it('reads a Garmin workout with reps of a minute or more as quality, and strides as an easy run', () => {
    const threshold = garmin('Threshold 3 x 7:00', [
      { kind: 'warmup', minutes: 12 },
      { kind: 'effort', minutes: 7, rep: 1 },
      { kind: 'recovery', minutes: 4, rep: 1 },
    ])
    const strides = garmin('Strides 6 x 20s', [
      { kind: 'effort', minutes: 50 },
      { kind: 'effort', minutes: 0, seconds: 20, rep: 1 },
      { kind: 'recovery', minutes: 1, rep: 1 },
    ])
    expect(sessionKind(threshold)).toBe('quality')
    expect(sessionKind(strides)).toBe('easy')
  })

  it('never advises moderation for a rest day, or easing off a race', () => {
    const rest = todayInsightPrompt(context({ tone: 'caution', plannedWorkout: null }), [])
    expect(rest).toContain('- Today is a rest day')
    expect(rest).toContain('Say the rest is well placed')
    expect(rest).not.toContain('- Planned today')

    const race = todayInsightPrompt(context({ tone: 'hold', plannedWorkout: { ...workout, type: 'Race', name: 'Semi de Luxembourg' } }), [])
    expect(race).toContain('- Today is race day')
    expect(race).toContain('Never tell the athlete to skip the race or ease off it')
  })

  it('changes the guard when the kind of day changes, or a run is logged on a rest day', () => {
    const rest = context({ plannedWorkout: null })
    expect(todayInsightGuard(rest)).not.toBe(todayInsightGuard(context({ plannedWorkout: { ...workout, type: 'Race' } })))
    expect(todayInsightGuard(rest)).not.toBe(
      todayInsightGuard(context({ plannedWorkout: null, recent: { weekRuns: 6, weekKm: 44, lastRun: { type: 'Base', daysAgo: 0, distanceKm: 5 } } })),
    )
  })
})

describe('what the screen already shows (v4.16.4)', () => {
  it('hands the model the badge words it must not echo', () => {
    const prompt = todayInsightPrompt(context({ tone: 'go' }), [])
    expect(prompt).toContain(`shown in the badge above your headline as "${t.dashboard.readiness.eyebrowByTone.go}"`)
    expect(TODAY_SYSTEM_INSTRUCTION).toContain('Never reuse that phrase.')
  })

  it("keeps the session card's and the weekly card's numbers out of the copy", () => {
    expect(TODAY_SYSTEM_INSTRUCTION).toContain("this week's kilometres and sessions. Never state those numbers")
    expect(TODAY_SYSTEM_INSTRUCTION).not.toContain('The only numbers worth writing here')
  })
})

describe('one claim, one piece of advice', () => {
  it('asks for a claim over a single sentence of advice that fits two lines', () => {
    expect(TODAY_SYSTEM_INSTRUCTION).toContain('The headline is one claim, never advice')
    expect(TODAY_SYSTEM_INSTRUCTION).toContain('the one piece of advice that follows from the headline, in a single sentence')
    expect(TODAY_SYSTEM_INSTRUCTION).toContain(`at most ${TODAY_LIMITS.body} characters`)
    expect(TODAY_LIMITS.body).toBeLessThanOrEqual(80)
  })

  it('never lets one sentence worry and reassure at once', () => {
    expect(TODAY_SYSTEM_INSTRUCTION).toContain('Never write a sentence that both worries and reassures')
  })

  it('never advises changing the plan', () => {
    expect(TODAY_SYSTEM_INSTRUCTION).toContain('The plan is read-only in the app')
    expect(TODAY_SYSTEM_INSTRUCTION).toContain('never to move, swap, reschedule or edit a session')
  })

  it('writes no status label, its own badge or any other', () => {
    for (const label of Object.values(t.dashboard.readiness.eyebrowByTone)) expect(TODAY_SYSTEM_INSTRUCTION).toContain(`"${label}"`)
    expect(TODAY_SYSTEM_INSTRUCTION).toContain('not the training status from the facts')
  })

  it('agrees with the tone the app shows, building included', () => {
    const prompt = todayInsightPrompt(context({ tone: 'build' }), [])
    expect(prompt).toContain(`Tone: build, shown in the badge above your headline as "${t.dashboard.readiness.eyebrowByTone.build}"`)
    expect(prompt).toContain('The training load is in range.')
  })
})
