import { describe, expect, it } from 'vitest'
import { plan, workout } from '@/domain/coaching/__tests__/fixtures'
import { coachWords, getCoachWords } from '../GetCoachWords'

const coachingPlan = plan({
  block: { id: 'block-1', name: ' Reprise en douceur ', startDate: '2026-09-07', endDate: '2026-10-04', focus: 'Trois sorties par semaine.' },
  weeks: [
    {
      id: 'week-1',
      index: 1,
      startDate: '2026-09-07',
      endDate: '2026-09-13',
      focus: 'On démarre doucement.',
      workouts: [workout({ notes: ['Au moindre signe inhabituel, passe à la marche.', ' '] }), workout({ id: 'workout-bare', notes: undefined })],
    },
  ],
})

describe('coachWords', () => {
  it('carries the block, each week and each session in the coach’s own words', () => {
    expect(coachWords(coachingPlan)).toEqual({
      block: { name: 'Reprise en douceur', focus: 'Trois sorties par semaine.' },
      weeks: [{ startDate: '2026-09-07', endDate: '2026-09-13', focus: 'On démarre doucement.' }],
      sessions: {
        'workout-threshold': { description: 'Controlled threshold repetitions.', notes: ['Au moindre signe inhabituel, passe à la marche.'], steps: [] },
        'workout-bare': { description: 'Controlled threshold repetitions.', notes: [], steps: [] },
      },
    })
  })

  it('carries the notes the coach wrote on a step, and which steps sit in a repeat', () => {
    const noted = workout({
      blocks: [
        { kind: 'warmup', target: { durationSeconds: 600 }, notes: [' About 10 minutes of easy jogging. '] },
        {
          kind: 'repeat',
          repetitions: 3,
          steps: [
            { kind: 'effort', target: { durationSeconds: 600 }, notes: ['Run the guide pace first.', ' '] },
            { kind: 'recovery', target: { durationSeconds: 90 } },
          ],
        },
        { kind: 'cooldown', target: { durationSeconds: 600 } },
      ],
    })
    const words = coachWords({ ...coachingPlan, weeks: [{ ...coachingPlan.weeks[0]!, workouts: [noted] }] })
    expect(words.sessions[noted.id]!.steps).toEqual([
      { kind: 'warmup', repeated: false, notes: ['About 10 minutes of easy jogging.'] },
      { kind: 'effort', repeated: true, notes: ['Run the guide pace first.'] },
    ])
  })

  it('carries nothing of the goal, the race or the provenance', () => {
    const payload = JSON.stringify(coachWords(coachingPlan))
    for (const text of ['Autumn 10K', 'provenance', 'demo', 'goal']) expect(payload).not.toContain(text)
  })

  it('carries the pace-guide proposals the block left open, and drops one it adopted', () => {
    const open = { repClass: 'long' as const, source: 'sessions' as const, guide: { min: 272, max: 280 }, proposedGuide: { min: 268, max: 276 }, dates: ['2026-09-01', '2026-09-03'], adopted: false }
    const adopted = { ...open, repClass: 'short' as const, source: 'fitness_check' as const, dates: ['2026-09-05'], adopted: true }
    const proposing = { ...coachingPlan, block: { ...coachingPlan.block, guideProposals: [open, adopted] } }
    expect(coachWords(proposing).block.guideProposals).toEqual([open])
    expect(coachWords({ ...coachingPlan, block: { ...coachingPlan.block, guideProposals: [adopted] } }).block).not.toHaveProperty('guideProposals')
  })

  it('is none without a plan', () => {
    expect(getCoachWords({ getCurrentPlan: () => null })).toBeNull()
    expect(getCoachWords({ getCurrentPlan: () => coachingPlan })?.block.name).toBe('Reprise en douceur')
  })
})
