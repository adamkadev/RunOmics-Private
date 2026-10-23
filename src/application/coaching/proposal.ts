import type { CoachDecision, CoachingPlan, WorkoutEvaluation } from '@/domain/coaching/types'
import { parseCoachDecision, parseCoachingPlan, parseWorkoutEvaluation } from '@/domain/coaching/validation'

export interface CoachingProposal {
  schemaVersion: 1
  id: string
  kind: 'bootstrap' | 'post_activity' | 'weekly_review' | 'autoregulation'
  createdAt: string
  referenceDate: string
  contextHash: string
  basePlanId: string | null
  basePlanRevision: number | null
  proposedPlan?: CoachingPlan
  decision: CoachDecision
  evaluation?: WorkoutEvaluation
}

export function parseCoachingProposal(value: unknown): CoachingProposal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('proposal must be an object')
  const raw = value as Record<string, unknown>
  if (raw.schemaVersion !== 1) throw new Error(`unsupported proposal schema version ${String(raw.schemaVersion)}`)
  if (raw.kind !== 'bootstrap' && raw.kind !== 'post_activity' && raw.kind !== 'weekly_review' && raw.kind !== 'autoregulation') {
    throw new Error(`unsupported proposal kind ${String(raw.kind)}`)
  }
  const requiredString = (field: string): string => {
    const item = raw[field]
    if (typeof item !== 'string' || !item) throw new Error(`proposal.${field} must be a non-empty string`)
    return item
  }
  const createdAt = requiredString('createdAt')
  if (Number.isNaN(Date.parse(createdAt))) throw new Error('proposal.createdAt must be an ISO timestamp')
  const referenceDate = requiredString('referenceDate')
  const parsedReferenceDate = new Date(`${referenceDate}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate) || Number.isNaN(parsedReferenceDate.getTime()) || parsedReferenceDate.toISOString().slice(0, 10) !== referenceDate) {
    throw new Error('proposal.referenceDate must be a valid YYYY-MM-DD date')
  }
  const nullableRevision = raw.basePlanRevision
  if (nullableRevision !== null && (!Number.isInteger(nullableRevision) || (nullableRevision as number) < 1)) {
    throw new Error('proposal.basePlanRevision must be null or a positive integer')
  }
  const basePlanId = raw.basePlanId
  if (basePlanId !== null && (typeof basePlanId !== 'string' || !basePlanId)) throw new Error('proposal.basePlanId must be null or a string')

  const proposal: CoachingProposal = {
    schemaVersion: 1,
    id: requiredString('id'),
    kind: raw.kind,
    createdAt,
    referenceDate,
    contextHash: requiredString('contextHash'),
    basePlanId: basePlanId as string | null,
    basePlanRevision: nullableRevision as number | null,
    ...(raw.proposedPlan === undefined ? {} : { proposedPlan: parseCoachingPlan(raw.proposedPlan, 'proposal.proposedPlan') }),
    decision: parseCoachDecision(raw.decision, 'proposal.decision'),
    ...(raw.evaluation === undefined ? {} : { evaluation: parseWorkoutEvaluation(raw.evaluation, 'proposal.evaluation') }),
  }
  if (proposal.kind === 'bootstrap' && !proposal.proposedPlan) throw new Error('bootstrap proposal requires proposedPlan')
  if (proposal.kind === 'post_activity' && !proposal.evaluation) throw new Error('post_activity proposal requires evaluation')
  if ((proposal.basePlanId === null) !== (proposal.basePlanRevision === null)) throw new Error('proposal base plan id and revision must both be present or both be null')
  if (proposal.kind === 'bootstrap') {
    // A bootstrap may supersede an active block: basePlanId names the plan it was built against, for the
    // staleness check, while its decision opens a new plan and so has no base revision.
    if (proposal.decision.basePlanRevision !== null) throw new Error('bootstrap decision must not have a base plan revision')
    if (proposal.basePlanId !== null && proposal.basePlanId === proposal.proposedPlan?.id) {
      throw new Error('bootstrap proposal must not supersede itself')
    }
    if (proposal.proposedPlan?.id !== proposal.decision.planId) throw new Error('bootstrap proposal plan and decision ids must match')
  } else {
    if (proposal.basePlanId === null || proposal.basePlanRevision === null) throw new Error('adaptation proposal requires a base plan')
    if (proposal.decision.planId !== proposal.basePlanId || proposal.decision.basePlanRevision !== proposal.basePlanRevision) {
      throw new Error('proposal base plan and decision must match')
    }
  }
  if (proposal.decision.createdAt !== proposal.createdAt) throw new Error('proposal and decision timestamps must match')
  if (proposal.evaluation && (proposal.evaluation.decisionId !== proposal.decision.id || proposal.evaluation.planId !== proposal.decision.planId)) {
    throw new Error('proposal evaluation must reference its decision and plan')
  }
  return proposal
}
