import { describe, expect, it } from 'vitest'
import type { BootstrapWorkoutDraft, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import { buildCoachingContext } from '../context'
import { validateBootstrapDraftSemantics } from '../bootstrapValidation'
import { validateDraftFrequency } from '../frequency'

const context = buildCoachingContext({ activities: [], plan: null, athlete: {}, trainingStatus: null, loadBalance: null, trainingZones: null, latestVo2max: null, racePredictions: null, goals: [], personalBests: [], upcomingRaces: [] }, '2026-09-05')
const strategy = {
  planningStartDate: '2026-09-06',
  primary: { id: 'primary', name: 'Wintzenheim', date: '2026-11-29', distanceMeters: 10_000, targetSeconds: 2400 },
  tuneUps: [{ id: 'tuneup', name: 'Broscht', date: '2026-10-03', distanceMeters: 5000, targetSeconds: 1200 }],
}
const workout = (date: string, type: BootstrapWorkoutDraft['type'] = 'easy'): BootstrapWorkoutDraft => ({ date, type, title: 'Session', description: 'Controlled effort', blocks: [{ kind: 'effort', target: { distanceMeters: 5000, hrZone: 2 } }] })
const draft = (workouts: BootstrapWorkoutDraft[]): CoachingPlanDraft => ({ name: 'Aerobic block', focus: '10K development', weeks: [{ startDate: '2026-09-27', endDate: '2026-10-03', focus: 'Fewer runs for taper freshness, with a rest day between sharpening and shakeout', workouts: [...workouts, workout('2026-10-03', 'race')] }] })

describe('race preparation safeguards', () => {
  it('accepts four runs including the race with an explicit taper reason', () => {
    const plan = draft(['2026-09-27', '2026-09-29', '2026-10-01'].map(date => workout(date)))
    expect(() => validateBootstrapDraftSemantics(plan, strategy, context)).not.toThrow()
    expect(() => validateDraftFrequency(plan, 5)).not.toThrow()
  })
  it('rejects the Tue/Wed/Thu taper streak even when it satisfies five requested runs', () => {
    const plan = draft(['2026-09-27', '2026-09-29', '2026-09-30', '2026-10-01'].map(date => workout(date)))
    expect(() => validateBootstrapDraftSemantics(plan, strategy, context)).toThrow('three consecutive runs')
  })
  it('allows five well-spaced runs; does not make four runs a new quota', () => {
    const plan = draft(['2026-09-27', '2026-09-28', '2026-09-30', '2026-10-02'].map(date => workout(date)))
    expect(() => validateBootstrapDraftSemantics(plan, strategy, context)).not.toThrow()
    expect(() => validateDraftFrequency(plan, 5)).not.toThrow()
  })
  it('allows one controlled specific stimulus followed by an easy long run', () => {
    const plan = draft([workout('2026-09-24', 'vo2max'), workout('2026-09-26', 'long_run')])
    expect(() => validateBootstrapDraftSemantics(plan, strategy, context)).not.toThrow()
    plan.weeks[0]!.workouts[1]!.blocks.push({ kind: 'effort', target: { distanceMeters: 3000, hrZone: 3 } })
    expect(() => validateBootstrapDraftSemantics(plan, strategy, context)).toThrow('must remain easy')
  })
  it('does not allow the 10K block to become repeated faster sessions', () => {
    const plan = draft([workout('2026-09-17', 'vo2max'), workout('2026-09-24', 'vo2max')])
    expect(() => validateBootstrapDraftSemantics(plan, strategy, context)).toThrow('at most one')
  })
})

it('rejects constant exact race pace with course context but retains generic flat-race behavior', () => {
  const plan = draft([])
  const race = plan.weeks[0]!.workouts[0]!
  race.blocks = [{ kind: 'effort', target: { distanceMeters: 5000, paceSecPerKm: { min: 240, max: 240 } } }]
  const course = { ...strategy, tuneUps: strategy.tuneUps.map(event => ({ ...event, courseContext: { pacingNotes: ['Hilly course; follow PacePro effort.'] } })) }
  expect(() => validateBootstrapDraftSemantics(plan, strategy, context)).not.toThrow()
  expect(() => validateBootstrapDraftSemantics(plan, course, context)).toThrow('constant exact pace')
  race.blocks = [{ kind: 'effort', target: { distanceMeters: 5000 }, notes: ['Average goal pace: 4:00/km; follow PacePro and terrain.'] }]
  expect(() => validateBootstrapDraftSemantics(plan, course, context)).not.toThrow()
})
