import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBootstrapProposal } from '../workflows'
import { buildCoachingContext } from '../context'
import { readProposalPreview, writeProposalPreview } from '../preview'
import type { CoachingAdvisor, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import { plan } from '@/domain/coaching/__tests__/fixtures'

const NAMED = {
  threshold: { title: 'Threshold · 3 × 8′', shortName: 'Threshold 3×8′' },
  easy: { title: 'Easy run', shortName: 'Easy run' },
} as const

function fourWeekPlan(): CoachingPlanDraft {
  const draft = plan()
  const persistent = {
    ...draft,
    weeks: [
      ...draft.weeks,
      { id: 'week-3', index: 3, startDate: '2026-09-21', endDate: '2026-09-27', focus: 'Specific endurance', workouts: [{ ...draft.weeks[1]!.workouts[0]!, id: 'workout-3', date: '2026-09-22' }] },
      { id: 'week-4', index: 4, startDate: '2026-09-28', endDate: '2026-10-04', focus: 'Absorb', workouts: [{ ...draft.weeks[1]!.workouts[0]!, id: 'workout-4', date: '2026-09-29' }] },
    ],
  }
  return {
    name: persistent.block.name,
    focus: persistent.block.focus,
    weeks: persistent.weeks.map((week) => ({
      startDate: week.startDate,
      endDate: week.endDate,
      focus: week.focus,
      workouts: week.workouts.map((workout) => ({
        date: workout.date,
        type: workout.type,
        ...NAMED[workout.type as keyof typeof NAMED],
        description: workout.description,
        blocks: workout.blocks,
        ...(workout.notes ? { notes: workout.notes } : {}),
      })),
    })),
  }
}

const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })))

describe('coaching preview files', () => {
  it('writes a private proposal without mutating the repository', async () => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-preview-'))
    dirs.push(output)
    let saved = false
    const repository = {
      getCurrentPlan: () => null,
      saveCurrentPlan: () => { saved = true },
      getState: () => null,
      saveState: () => { saved = true },
      getDecisions: () => [],
      getDecision: () => null,
      saveDecision: () => { saved = true },
      getEvaluations: () => [],
      getEvaluationForActivity: () => null,
      saveEvaluation: () => { saved = true },
    } satisfies CoachingRepository
    const advisor = {
      bootstrap: async () => fourWeekPlan(),
      evaluateActivity: async () => { throw new Error('not called') },
      reviewWeek: async () => { throw new Error('not called') },
    } satisfies CoachingAdvisor
    const context = buildCoachingContext({
      activities: [], plan: null, athlete: {}, trainingStatus: null, loadBalance: null,
      trainingZones: null, trajectories: null, latestVo2max: null, racePredictions: null, personalBests: [],
      goals: [], upcomingRaces: [{ date: '2026-10-18', name: 'Autumn 10K', distance: '10K' }], officialResults: [],
    }, '2026-09-07')
    let id = 0
    const proposal = await createBootstrapProposal(context, [2, 3], {
      advisor, repository, id: () => `id-${++id}`, now: () => new Date('2026-09-07T08:00:00Z'),
    })

    const filePath = writeProposalPreview(proposal, output)
    expect(saved).toBe(false)
    expect(fs.statSync(filePath).mode & 0o777).toBe(0o600)
    expect(readProposalPreview(filePath)).toEqual(proposal)
  })

  it('rejects inconsistent proposal references before writing a preview', async () => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-preview-'))
    dirs.push(output)
    const repository = {
      getCurrentPlan: () => null, saveCurrentPlan: () => {}, getState: () => null, saveState: () => {},
      getDecisions: () => [], getDecision: () => null, saveDecision: () => {}, getEvaluations: () => [],
      getEvaluationForActivity: () => null, saveEvaluation: () => {},
    } satisfies CoachingRepository
    const context = buildCoachingContext({
      activities: [], plan: null, athlete: {}, trainingStatus: null, loadBalance: null, trainingZones: null, trajectories: null,
      latestVo2max: null, racePredictions: null, personalBests: [], goals: [],
      upcomingRaces: [{ date: '2026-10-18', name: 'Autumn 10K', distance: '10K' }],
      officialResults: [],
    }, '2026-09-07')
    let id = 0
    const proposal = await createBootstrapProposal(context, [2, 3], {
      repository,
      advisor: { bootstrap: async () => fourWeekPlan(), evaluateActivity: async () => { throw new Error('not called') }, reviewWeek: async () => { throw new Error('not called') } },
      id: () => `id-${++id}`,
      now: () => new Date('2026-09-07T08:00:00Z'),
    })

    expect(() => writeProposalPreview({ ...proposal, decision: { ...proposal.decision, planId: 'other-plan' } }, output)).toThrow(/ids must match/)
    expect(fs.readdirSync(output)).toEqual([])
  })
})
