import { describe, expect, it } from 'vitest'
import { todayInsightHash, todayInsightPrompt, type TodayContext } from '../todayInsight'
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
  atlDelta: 6,
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
    recent: { runs: 5, km: 39, lastRun: { type: 'Base', daysAgo: 1, distanceKm: 5 } },
    ...overrides,
  }
}

describe('todayInsightPrompt', () => {
  it('advises approaching the session when it is still ahead', () => {
    const prompt = todayInsightPrompt(context(), [])

    expect(prompt).toContain('Advise easing off, going easy or resting.')
    expect(prompt).not.toContain('already been completed')
  })

  // The hero's own checkbox already shows the planned session done once a run
  // lands today - copy that still tells the athlete how to approach it reads
  // as if it never saw the activity that just synced.
  it('writes about the session in the past once it has already been run today', () => {
    const prompt = todayInsightPrompt(
      context({ recent: { runs: 6, km: 44, lastRun: { type: 'Base', daysAgo: 0, distanceKm: 5 } } }),
      []
    )

    expect(prompt).toContain('Acknowledge it is done and turn to what recovering from it now looks like.')
    expect(prompt).toContain('- This session has already been completed today')
    expect(prompt).not.toContain('Advise easing off, going easy or resting.')
  })

  it('is unaffected by a run logged today on a rest day, since there is no session to have completed', () => {
    const prompt = todayInsightPrompt(
      context({ plannedWorkout: null, recent: { runs: 6, km: 44, lastRun: { type: 'Base', daysAgo: 0, distanceKm: 5 } } }),
      []
    )

    expect(prompt).toContain('Advise easing off, going easy or resting.')
    expect(prompt).not.toContain('already been completed')
  })
})

describe('todayInsightHash', () => {
  it('changes once the planned session is logged as run today, so the stale forward-looking copy is not served back', () => {
    const before = todayInsightHash(context({ recent: { runs: 5, km: 39, lastRun: { type: 'Base', daysAgo: 1, distanceKm: 5 } } }))
    const after = todayInsightHash(context({ recent: { runs: 6, km: 44, lastRun: { type: 'Base', daysAgo: 0, distanceKm: 5 } } }))

    expect(before).not.toBe(after)
  })
})
