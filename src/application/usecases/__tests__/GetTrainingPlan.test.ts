import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TrainingPlanRaw } from '@/infrastructure/repositories/JsonTrainingPlanRepository'

const { readTrainingPlan } = vi.hoisted(() => ({ readTrainingPlan: vi.fn() }))
vi.mock('@/infrastructure/repositories/JsonTrainingPlanRepository', () => ({ getTrainingPlan: readTrainingPlan }))

const { getTrainingPlan, garminPlanPhase } = await import('../GetTrainingPlan')

function plan(overrides: Partial<TrainingPlanRaw> = {}): TrainingPlanRaw {
  return {
    planId: 1,
    name: 'Half Marathon Level 3',
    startDate: '2026-03-02',
    endDate: '2026-06-14',
    phases: [
      { phase: 'BUILD', startDate: '2026-04-06', endDate: '2026-05-10' },
      { phase: 'PEAK', startDate: '2026-05-11', endDate: '2026-05-31' },
      { phase: 'TAPER', startDate: '2026-06-01', endDate: '2026-06-13' },
      { phase: 'TARGET_EVENT_DAY', startDate: '2026-06-14', endDate: '2026-06-14' },
    ],
    ...overrides,
  }
}

describe('garminPlanPhase', () => {
  it('renames every phase Garmin publishes', () => {
    expect(garminPlanPhase('BUILD')).toBe('build')
    expect(garminPlanPhase('PEAK')).toBe('peak')
    expect(garminPlanPhase('TAPER')).toBe('taper')
    expect(garminPlanPhase('TARGET_EVENT_DAY')).toBe('raceDay')
  })

  it('null for a phase name Garmin never sends', () => {
    expect(garminPlanPhase('RECOVERY_BLOCK')).toBeNull()
    expect(garminPlanPhase(null)).toBeNull()
    expect(garminPlanPhase(undefined)).toBeNull()
    expect(garminPlanPhase('')).toBeNull()
  })
})

describe('getTrainingPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('null when the athlete has no plan on the watch', () => {
    readTrainingPlan.mockReturnValue(null)

    expect(getTrainingPlan()).toBeNull()
  })

  it('null when not one of the phases can be named', () => {
    readTrainingPlan.mockReturnValue(plan({ phases: [{ phase: 'MYSTERY', startDate: '2026-04-06', endDate: '2026-05-10' }] }))

    expect(getTrainingPlan()).toBeNull()
  })

  it('keeps the plan title and its own dates', () => {
    readTrainingPlan.mockReturnValue(plan())

    expect(getTrainingPlan()).toMatchObject({
      name: 'Half Marathon Level 3',
      startDate: '2026-03-02',
      endDate: '2026-06-14',
    })
  })

  it('reconstructs the base block Garmin never publishes as a phase', () => {
    readTrainingPlan.mockReturnValue(plan())

    expect(getTrainingPlan()?.ranges[0]).toEqual({
      phase: 'base',
      startDate: '2026-03-02',
      endDate: '2026-04-05',
    })
  })

  it('leaves no gap between the base block and the phase that follows', () => {
    readTrainingPlan.mockReturnValue(plan())
    const [base, build] = getTrainingPlan()!.ranges

    expect(new Date(build!.startDate).getTime() - new Date(base!.endDate).getTime()).toBe(86_400_000)
  })

  it('steps back across a month boundary to close the base block', () => {
    readTrainingPlan.mockReturnValue(
      plan({
        startDate: '2026-02-16',
        phases: [{ phase: 'BUILD', startDate: '2026-03-01', endDate: '2026-04-05' }],
      })
    )

    expect(getTrainingPlan()?.ranges[0]?.endDate).toBe('2026-02-28')
  })

  it('adds no base block when the plan opens on its first phase', () => {
    readTrainingPlan.mockReturnValue(plan({ startDate: '2026-04-06' }))

    expect(getTrainingPlan()?.ranges.map((r) => r.phase)).toEqual(['build', 'peak', 'taper', 'raceDay'])
  })

  it('brackets every phase it recognises, in plan order', () => {
    readTrainingPlan.mockReturnValue(plan({ startDate: '2026-04-06' }))

    expect(getTrainingPlan()?.ranges[1]).toEqual({
      phase: 'peak',
      startDate: '2026-05-11',
      endDate: '2026-05-31',
    })
  })

  it('drops a phase it cannot name rather than showing it unlabelled', () => {
    readTrainingPlan.mockReturnValue(
      plan({
        startDate: '2026-04-06',
        phases: [
          { phase: 'BUILD', startDate: '2026-04-06', endDate: '2026-05-10' },
          { phase: 'MYSTERY', startDate: '2026-05-11', endDate: '2026-05-31' },
          { phase: 'TAPER', startDate: '2026-06-01', endDate: '2026-06-13' },
        ],
      })
    )

    expect(getTrainingPlan()?.ranges.map((r) => r.phase)).toEqual(['build', 'taper'])
  })
})
