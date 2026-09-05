import { describe, expect, it } from 'vitest'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import type { CoachingAdvisor } from '@/application/ports/CoachingAdvisor'
import { buildCoachingContext } from '@/application/coaching/context'
import { createBootstrapProposal } from '@/application/coaching/workflows'
import { BOOTSTRAP_PLAN_RESPONSE_SCHEMA, parseBootstrapPlanDraft } from '../GeminiCoachingAdvisor'

const repository: CoachingRepository = {
  getCurrentPlan: () => null,
  saveCurrentPlan: () => {},
  getState: () => null,
  saveState: () => {},
  getDecisions: () => [],
  getDecision: () => null,
  saveDecision: () => {},
  getEvaluations: () => [],
  getEvaluationForActivity: () => null,
  saveEvaluation: () => {},
}

function rawBootstrap(includePlaceholderIds: boolean) {
  const iso = (offset: number) => new Date(Date.UTC(2026, 8, 7 + offset)).toISOString().slice(0, 10)
  return {
    name: 'Four-week 10K block',
    focus: 'Aerobic durability',
    weeks: Array.from({ length: 4 }, (_, weekIndex) => {
      const weekOffset = weekIndex * 7
      const date = iso(weekOffset + 1)
      return {
        ...(includePlaceholderIds ? { id: 'draft-week' } : {}),
        startDate: iso(weekOffset),
        endDate: iso(weekOffset + 6),
        focus: `Week ${weekIndex + 1}`,
        workouts: [0, 1].map((workoutIndex) => ({
          ...(includePlaceholderIds ? { id: 'draft-workout' } : {}),
          date,
          type: workoutIndex === 0 ? 'easy' : 'tempo',
          title: workoutIndex === 0 ? 'Easy run' : 'Tempo run',
          description: 'A structurally valid session.',
          totalDistanceMeters: 999_999,
          blocks: [{ kind: 'effort', target: { distanceMeters: 5_000 } }],
        })),
      }
    }),
  }
}

function context() {
  return buildCoachingContext({
    activities: [],
    plan: null,
    athlete: {},
    trainingStatus: null,
    loadBalance: null,
    trainingZones: null,
    latestVo2max: null,
    racePredictions: null,
    goals: [],
    personalBests: [],
    upcomingRaces: [{ date: '2026-10-18', name: 'Autumn 10K', distance: '10K' }],
  }, '2026-09-07')
}

describe('Gemini bootstrap draft boundary', () => {
  it('does not ask Gemini for persistent week or workout IDs or calculated totals', () => {
    const week = BOOTSTRAP_PLAN_RESPONSE_SCHEMA.properties.weeks.items
    const workout = week.properties.workouts.items

    expect(week.properties).not.toHaveProperty('id')
    expect(workout.properties).not.toHaveProperty('id')
    expect(workout.properties).not.toHaveProperty('totalDurationSeconds')
    expect(workout.properties).not.toHaveProperty('totalDistanceMeters')
  })

  it.each([
    ['repeated placeholder IDs', true],
    ['absent IDs', false],
  ])('materializes unique persistent workout IDs when draft IDs are %s', async (_label, includePlaceholderIds) => {
    const draft = parseBootstrapPlanDraft(rawBootstrap(includePlaceholderIds))
    const advisor: CoachingAdvisor = {
      bootstrap: async () => draft,
      evaluateActivity: async () => { throw new Error('not called') },
      reviewWeek: async () => { throw new Error('not called') },
    }
    let nextId = 0
    const proposal = await createBootstrapProposal(context(), [2], {
      advisor,
      repository,
      id: () => `persistent-${++nextId}`,
      now: () => new Date('2026-09-07T08:00:00.000Z'),
    })
    const workouts = proposal.proposedPlan!.weeks.flatMap((week) => week.workouts)

    expect(draft.weeks.flatMap((week) => week.workouts).every((workout) => !('id' in workout))).toBe(true)
    expect(new Set(workouts.map((workout) => workout.id)).size).toBe(workouts.length)
    expect(workouts.map((workout) => workout.id)).toEqual([
      'persistent-1:workout:1:1', 'persistent-1:workout:1:2',
      'persistent-1:workout:2:1', 'persistent-1:workout:2:2',
      'persistent-1:workout:3:1', 'persistent-1:workout:3:2',
      'persistent-1:workout:4:1', 'persistent-1:workout:4:2',
    ])
    expect(workouts.every((workout) => workout.revision === 1)).toBe(true)
    expect(workouts.every((workout) => workout.totalDistanceMeters === 5_000)).toBe(true)
  })
})
