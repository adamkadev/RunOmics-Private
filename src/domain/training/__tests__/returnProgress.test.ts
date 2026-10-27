import { describe, expect, it } from 'vitest'
import type { Activity, ActivitySplit } from '@/domain/activity/types'
import { latestReturnBreak, longestContinuousRunSeconds, returnMilestones, returnWeeks, runningTime } from '../returnProgress'

type Run = Pick<Activity, 'id' | 'date' | 'splits' | 'durationSeconds' | 'longestContinuousRunSec' | 'longestContinuousRunM' | 'runningSec'>

const run = (id: string, date: string, longestSec: number | null, longestM: number | null = null, overrides: Partial<Run> = {}): Run => ({
  id, date, splits: null, durationSeconds: 1800, longestContinuousRunSec: longestSec, longestContinuousRunM: longestM, runningSec: longestSec, ...overrides,
})

const split = (type: ActivitySplit['type'], durationSec: number, distanceM: number): ActivitySplit =>
  ({ type, durationSec, distanceM, avgSpeedMs: 2, avgHr: null, laps: [] })

describe('runningTime', () => {
  it('reads what the sync stored', () => {
    expect(runningTime(run('a', '2026-10-01', 600, 1300, { runningSec: 1500 }))).toEqual({ longestSec: 600, longestM: 1300, runningSec: 1500 })
  })

  it('falls back to the splits, walking splits ending a bout', () => {
    const splits = [split('interval_warmup', 300, 400), split('interval_active', 240, 500), split('interval_recovery', 60, 70), split('interval_active', 300, 650)]
    expect(runningTime(run('a', '2026-10-01', null, null, { splits }))).toEqual({ longestSec: 300, longestM: 650, runningSec: 540 })
    expect(longestContinuousRunSeconds(run('a', '2026-10-01', null, null, { splits }))).toBe(300)
  })

  it('says nothing for a run with neither', () => {
    expect(runningTime(run('a', '2026-10-01', null))).toBeNull()
  })
})

describe('latestReturnBreak', () => {
  it('takes the latest break of four weeks or more', () => {
    const breaks = [
      { start: '2025-01-01', end: '2025-06-30', reason: 'injury' },
      { start: '2026-03-01', end: '2026-10-05', reason: 'personal' },
      { start: '2026-10-10', end: '2026-10-15', reason: 'travel' },
    ]
    expect(latestReturnBreak(breaks)?.end).toBe('2026-10-05')
    expect(latestReturnBreak(undefined)).toBeNull()
  })
})

describe('returnMilestones', () => {
  it('dates each milestone by its first run after the break', () => {
    const runs = [
      run('before', '2026-03-01', 3600, 9000),
      run('r1', '2026-10-08', 420, 900),
      run('r2', '2026-10-12', 660, 1500),
      run('r3', '2026-10-20', 1260, 3100),
      run('r4', '2026-10-24', 900, 2000),
    ]

    expect(returnMilestones(runs, '2026-10-05', '2026-10-26')).toEqual([
      { key: 'continuous10', date: '2026-10-12', activityId: 'r2' },
      { key: 'continuous20', date: '2026-10-20', activityId: 'r3' },
      { key: 'nonstop3k', date: '2026-10-20', activityId: 'r3' },
      { key: 'blockCompleted', date: '2026-10-26', activityId: null },
    ])
  })

  it('counts no block completed before the return', () => {
    expect(returnMilestones([], '2026-10-05', '2026-09-30')).toEqual([])
  })
})

describe('returnWeeks', () => {
  it('sums running time per week from the return, empty weeks kept', () => {
    const runs = [
      run('before', '2026-10-05', 3000, null, { runningSec: 3000 }),
      run('r1', '2026-10-07', 300, null, { runningSec: 900 }),
      run('r2', '2026-10-09', 420, null, { runningSec: 1200 }),
      run('r3', '2026-10-22', 600, null, { runningSec: 1500 }),
    ]

    expect(returnWeeks(runs, '2026-10-05', '2026-10-27')).toEqual([
      { weekStart: '2026-10-05', runningSec: 2100, longestSec: 420 },
      { weekStart: '2026-10-12', runningSec: 0, longestSec: 0 },
      { weekStart: '2026-10-19', runningSec: 1500, longestSec: 600 },
      { weekStart: '2026-10-26', runningSec: 0, longestSec: 0 },
    ])
  })
})
