import { execFileSync } from 'child_process'
import { describe, expect, it } from 'vitest'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import type { WorkoutEvaluation } from '@/domain/coaching/types'
import { getCoachingOverview, getTodayPrescription, sessionsAcrossPlans } from '../GetCoachingView'

const repository = { getCurrentPlan: () => plan(), getDecisions: () => [], getEvaluations: () => [] }

describe('reading the coaching plan', () => {
  it('reads the repository it is given rather than the one on disk', () => {
    expect(getCoachingOverview('2026-09-15', repository)?.currentWeekId).toBe('week-2')
    expect(getTodayPrescription('2026-09-15', repository)?.id).toBe('workout-easy')
  })

  it('has nothing to show before a plan exists', () => {
    const empty = { ...repository, getCurrentPlan: () => null }

    expect(getCoachingOverview('2026-09-15', empty)).toBeNull()
    expect(getTodayPrescription('2026-09-15', empty)).toBeNull()
  })

  it('keeps a superseded block\'s sessions on the days the current plan does not cover, with the run each was matched to', () => {
    const archived = plan({ id: 'old', weeks: [{ id: 'old:w', index: 1, startDate: '2026-09-07', endDate: '2026-09-13', focus: 'f', workouts: [
      workout({ id: 'old-tuesday', date: '2026-09-08' }),
      workout({ id: 'old-saturday', date: '2026-09-12' }),
    ] }] })
    const current = plan({ id: 'new', weeks: [{ id: 'new:w', index: 1, startDate: '2026-09-10', endDate: '2026-09-13', focus: 'f', workouts: [
      workout({ id: 'new-saturday', date: '2026-09-12' }),
    ] }] })
    const evaluation = { prescriptionId: 'old-tuesday', activityId: 'run-tuesday', matchStatus: 'matched' } as WorkoutEvaluation

    expect(sessionsAcrossPlans([current, archived], [evaluation]).map(({ prescription, activityId }) => [prescription.id, activityId])).toEqual([
      ['new-saturday', null],
      ['old-tuesday', 'run-tuesday'],
    ])
  })

  // In a child process because the time zone is process-wide; 20:00 UTC on Sunday is already Monday in Auckland.
  function currentWeekAt(env: Record<string, string>): string {
    const script = `
      const RealDate = Date
      const now = RealDate.parse('2026-09-13T20:00:00Z')
      globalThis.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : [now])) }
        static now() { return now }
      }
      const load = async (loading) => {
        const loaded = await loading
        const fallback = loaded.default
        return fallback && typeof fallback === 'object' ? { ...fallback, ...loaded } : loaded
      }
      ;(async () => {
        const { getCoachingOverview } = await load(import('./src/application/coaching/GetCoachingView.ts'))
        const { plan } = await load(import('./src/domain/coaching/__tests__/fixtures.ts'))
        const repository = { getCurrentPlan: () => plan(), getDecisions: () => [], getEvaluations: () => [] }
        process.stdout.write(String(getCoachingOverview(undefined, repository).currentWeekId))
      })().catch((error) => { console.error(error); process.exitCode = 1 })
    `
    return execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '-e', script], {
      cwd: process.cwd(),
      encoding: 'utf-8',
      env: { ...process.env, ...env },
    })
  }

  it('dates today by the local calendar when no zone is set, as the rest of the app does', () => {
    expect(currentWeekAt({ TZ: 'Pacific/Auckland', NEXT_PUBLIC_TIME_ZONE: '' })).toBe('week-2')
  })

  it("dates today in the athlete's zone on a UTC server", () => {
    expect(currentWeekAt({ TZ: 'UTC', NEXT_PUBLIC_TIME_ZONE: 'Pacific/Auckland' })).toBe('week-2')
  })
})
