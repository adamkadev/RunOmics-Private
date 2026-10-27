import { describe, expect, it } from 'vitest'
import type { Activity } from '@/domain/activity/types'
import type { CoachingPlan, WorkoutPrescription } from '@/domain/coaching/types'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import { buildReturnProgress } from '../GetReturnProgress'
import block from '../../../../fixtures/garmin/forerunner-55/walk-run-block.json'

const runs = block.runs as unknown as Activity[]

const walkRunPlan: CoachingPlan = plan({
  block: { id: 'b', name: 'Return', startDate: '2026-04-13', endDate: '2026-04-26', focus: 'Run/walk' },
  weeks: [
    { id: 'w1', index: 1, startDate: '2026-04-13', endDate: '2026-04-19', focus: 'Return', workouts: [] },
    { id: 'w2', index: 2, startDate: '2026-04-20', endDate: '2026-04-26', focus: 'Return', workouts: [] },
  ].map((week) => ({
    ...week,
    workouts: block.sessions
      .filter((session) => session.date >= week.startDate && session.date <= week.endDate)
      .map((session) => workout({ ...session, type: session.type as WorkoutPrescription['type'] })),
  })),
})

const BREAK = { start: '2025-09-01', end: '2026-04-12', reason: 'injury' as const }

const inputs = (overrides = {}) => ({ breaks: [BREAK], activities: runs, plans: [walkRunPlan], evaluations: [], ...overrides })

describe('buildReturnProgress', () => {
  it('reads a walk/run block from the splits, with the block completed on its last run', () => {
    const progress = buildReturnProgress(inputs(), '2026-04-27')!

    expect(progress.breakEnd).toBe('2026-04-12')
    expect(progress.milestones.at(-1)).toEqual({ key: 'blockCompleted', date: runs.map((run) => run.date).sort().at(-1), activityId: null })
    expect(progress.pending).not.toContain('blockCompleted')
    expect(progress.weeks.map((week) => week.weekStart)).toEqual(['2026-04-13', '2026-04-20', '2026-04-27'])
    expect(progress.weeks[0]!.runningSec).toBeGreaterThan(0)
    expect(progress.longestSec).toBe(Math.max(...progress.weeks.map((week) => week.longestSec)))
    expect(progress.ongoing).toBe(true)
  })

  it('leaves the block pending while one of its sessions is not run', () => {
    const progress = buildReturnProgress(inputs({ activities: runs.slice(0, -1) }), '2026-04-27')!

    expect(progress.pending).toContain('blockCompleted')
  })

  it('has nothing to say without a long break, or a year after it', () => {
    expect(buildReturnProgress(inputs({ breaks: undefined }), '2026-04-27')).toBeNull()
    expect(buildReturnProgress(inputs({ breaks: [{ ...BREAK, start: '2026-04-01' }] }), '2026-04-27')).toBeNull()
    expect(buildReturnProgress(inputs(), '2027-05-01')).toBeNull()
  })

  it('stops being ongoing two weeks after the first 30 minutes non-stop', () => {
    const long = { ...runs[0]!, id: 'long', date: '2026-05-01', longestContinuousRunSec: 1860, longestContinuousRunM: 4100, runningSec: 1860 }
    const progress = (today: string) => buildReturnProgress(inputs({ activities: [...runs, long] }), today)!

    expect(progress('2026-05-10').ongoing).toBe(true)
    expect(progress('2026-05-20').ongoing).toBe(false)
  })
})
