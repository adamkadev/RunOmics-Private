import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { COACHING_SCHEMA_VERSION, type CoachState, type WorkoutEvaluation } from '@/domain/coaching/types'
import { keepDecision, plan, provenance } from '@/domain/coaching/__tests__/fixtures'
import { JsonCoachingRepository } from '../JsonCoachingRepository'

describe('JsonCoachingRepository', () => {
  let root: string
  let repository: JsonCoachingRepository

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'runomics-coaching-'))
    repository = new JsonCoachingRepository(root)
  })

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  it('treats a missing coaching directory as an empty optional feature', () => {
    expect(repository.getCurrentPlan()).toBeNull()
    expect(repository.getState()).toBeNull()
    expect(repository.getDecisions()).toEqual([])
    expect(repository.getEvaluations()).toEqual([])
  })

  it('reads the archived plans back newest first, and none when nothing was archived', () => {
    expect(repository.getArchivedPlans()).toEqual([])
    const first = plan({ id: 'first', provenance: { ...plan().provenance, createdAt: '2026-09-01T08:00:00.000Z' } })
    const second = plan({ id: 'second', provenance: { ...plan().provenance, createdAt: '2026-09-20T08:00:00.000Z' } })
    repository.archivePlan(first)
    repository.archivePlan(second)

    expect(repository.getArchivedPlans().map((archived) => [archived.id, archived.status])).toEqual([
      ['second', 'superseded'],
      ['first', 'superseded'],
    ])
  })

  it('round-trips the current plan and state', () => {
    const currentPlan = plan()
    const state: CoachState = {
      schemaVersion: COACHING_SCHEMA_VERSION,
      activePlanId: currentPlan.id,
      activePlanRevision: currentPlan.revision,
      lastDecisionId: null,
      lastBootstrapAt: '2026-09-05T08:00:00.000Z',
      lastPostActivityAt: null,
      lastWeeklyReviewAt: null,
      updatedAt: '2026-09-05T08:00:00.000Z',
    }
    repository.saveCurrentPlan(currentPlan)
    repository.saveState(state)
    expect(repository.getCurrentPlan()).toEqual(currentPlan)
    expect(repository.getState()).toEqual(state)
  })

  it('upserts sharded history idempotently and writes manifests', () => {
    const decision = keepDecision()
    const evaluation: WorkoutEvaluation = {
      schemaVersion: COACHING_SCHEMA_VERSION,
      id: 'evaluation-1',
      activityId: 'activity-1',
      activityDate: '2026-09-09',
      prescriptionId: 'workout-threshold',
      planId: 'plan-1',
      planRevision: 1,
      matchStatus: 'matched',
      decisionId: decision.id,
      summary: decision.summary,
      createdAt: decision.createdAt,
      contextHash: 'context-hash',
      provenance: provenance('post_activity'),
    }
    repository.saveDecision(decision)
    repository.saveDecision({ ...decision, summary: 'Updated summary.' })
    repository.saveEvaluation(evaluation)

    expect(repository.getDecisions()).toHaveLength(1)
    expect(repository.getDecision(decision.id)?.summary).toBe('Updated summary.')
    expect(repository.getEvaluationForActivity('activity-1')).toEqual(evaluation)
    expect(JSON.parse(fs.readFileSync(path.join(root, 'coaching/decisions/index.json'), 'utf-8'))).toEqual({ keys: ['2026'] })
    expect(JSON.parse(fs.readFileSync(path.join(root, 'coaching/evaluations/index.json'), 'utf-8'))).toEqual({ keys: ['2026-09'] })
  })

  it('fails loudly for malformed persisted coaching data', () => {
    fs.mkdirSync(path.join(root, 'coaching'), { recursive: true })
    fs.writeFileSync(path.join(root, 'coaching/current_plan.json'), JSON.stringify({ schemaVersion: 99 }))
    expect(() => repository.getCurrentPlan()).toThrow(/unsupported schema version/)
  })
})
