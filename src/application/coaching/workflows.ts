import type { Activity } from '@/domain/activity/types'
import {
  COACHING_SCHEMA_VERSION,
  COACHING_TO_ACTIVITY_TYPE,
  type CoachDecision,
  type CoachPlanChange,
  type CoachState,
  type CoachingPlan,
  type CoachingProvenance,
  type AggregateWorkoutComparison,
  type TargetEvent,
  type TrainingGoal,
  type TrainingWeek,
  type WorkoutBlock,
  type WorkoutEvaluation,
  type WorkoutPrescription,
} from '@/domain/coaching/types'
import { applyCoachDecision, getFutureSnapshot } from '@/domain/coaching/lifecycle'
import { parseCoachDecision, parseCoachingPlan, parseWorkoutEvaluation } from '@/domain/coaching/validation'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import type { AdvisorRecommendation, CoachingAdvisor } from '@/application/ports/CoachingAdvisor'
import { coachingContextHash, type CoachingContext } from './context'
import type { CoachingProposal } from './proposal'
import { parseCoachingProposal } from './proposal'

const PROMPT_VERSION = 'coaching-v1'
const DAY_MS = 86_400_000

export interface WorkflowServices {
  advisor: CoachingAdvisor
  repository: CoachingRepository
  now?: () => Date
  id?: () => string
}

function defaultId(): string {
  return crypto.randomUUID()
}

function provenance(trigger: CoachingProvenance['trigger'], createdAt: string, decisionId?: string): CoachingProvenance {
  return {
    source: 'gemini',
    trigger,
    createdAt,
    promptVersion: PROMPT_VERSION,
    ...(decisionId ? { decisionId } : {}),
  }
}

function selectTargetEvent(context: CoachingContext, targetEventId?: string): TargetEvent {
  const race = targetEventId
    ? context.upcomingRaces.find((candidate) => {
        const identity = `${candidate.date}:${candidate.name}`
        return candidate.garminEventUuid === targetEventId || identity === targetEventId || candidate.name === targetEventId
      })
    : context.upcomingRaces[0]
  if (!race) throw new Error(targetEventId ? `Upcoming race not found: ${targetEventId}` : 'No upcoming race is available for bootstrap')
  return {
    id: race.garminEventUuid ?? `${race.date}:${race.name}`,
    name: race.name,
    date: race.date,
    distanceLabel: race.distance,
    ...(race.location ? { location: race.location } : {}),
  }
}

function selectGoal(context: CoachingContext, event: TargetEvent): TrainingGoal {
  const eventYear = Number(event.date.slice(0, 4))
  const target = context.goals.find((year) => year.year === eventYear)?.targets.find((candidate) => candidate.distance === event.distanceLabel)
  return target?.targetSeconds
    ? { kind: 'time', targetSeconds: target.targetSeconds, description: `Run ${event.distanceLabel} in the target time.` }
    : { kind: 'finish', description: `Complete ${event.name}.` }
}

function normalizeBootstrapPlan(
  draft: CoachingPlan,
  context: CoachingContext,
  availableWeekdays: number[],
  targetEventId: string | undefined,
  createdAt: string,
  id: () => string,
): CoachingPlan {
  if (draft.weeks.length !== 4) throw new Error('Bootstrap must produce exactly four weeks')
  const event = selectTargetEvent(context, targetEventId)
  const reference = new Date(`${context.referenceDate}T00:00:00Z`)
  const horizonEnd = new Date(reference.getTime() + 27 * DAY_MS).toISOString().slice(0, 10)
  const normalizedWeeks = draft.weeks.slice(0, 4).map((week, weekIndex) => ({
    ...week,
    id: id(),
    index: weekIndex + 1,
    workouts: week.workouts.map((workout) => ({
      ...workout,
      id: id(),
      revision: 1,
      status: 'prescribed' as const,
      provenance: provenance('bootstrap', createdAt),
    })),
  }))
  for (const week of normalizedWeeks) {
    for (const workout of week.workouts) {
      if (!availableWeekdays.includes(new Date(`${workout.date}T00:00:00Z`).getUTCDay())) {
        throw new Error(`${workout.date} is outside the available weekdays`)
      }
      if (workout.date < context.referenceDate || workout.date > horizonEnd) {
        throw new Error(`${workout.date} is outside the four-week rolling horizon`)
      }
    }
  }
  return parseCoachingPlan({
    ...draft,
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: id(),
    revision: 1,
    status: 'active',
    targetEvent: event,
    goal: selectGoal(context, event),
    block: {
      ...draft.block,
      id: id(),
      startDate: context.referenceDate,
      endDate: horizonEnd,
    },
    weeks: normalizedWeeks,
    provenance: provenance('bootstrap', createdAt),
  })
}

function findWorkout(plan: CoachingPlan, workoutId: string): WorkoutPrescription {
  const workout = plan.weeks.flatMap((week) => week.workouts).find((candidate) => candidate.id === workoutId)
  if (!workout) throw new Error(`Prescription not found: ${workoutId}`)
  return workout
}

function normalizeWorkout(
  draft: WorkoutPrescription,
  trigger: CoachingProvenance['trigger'],
  createdAt: string,
  decisionId: string,
  id: string,
  revision: number,
  status: WorkoutPrescription['status'],
): WorkoutPrescription {
  return {
    ...draft,
    id,
    revision,
    status,
    provenance: provenance(trigger, createdAt, decisionId),
  }
}

function normalizeWeeks(
  weeks: TrainingWeek[],
  plan: CoachingPlan,
  trigger: CoachingProvenance['trigger'],
  createdAt: string,
  decisionId: string,
  id: () => string,
): TrainingWeek[] {
  const existing = new Map(plan.weeks.flatMap((week) => week.workouts).map((workout) => [workout.id, workout]))
  const samePrescription = (draft: WorkoutPrescription, prior: WorkoutPrescription) => {
    const comparable = (prescription: WorkoutPrescription) => {
      const value: Partial<WorkoutPrescription> = { ...prescription }
      delete value.id
      delete value.revision
      delete value.status
      delete value.provenance
      return value
    }
    return JSON.stringify(comparable(draft)) === JSON.stringify(comparable(prior))
  }
  return weeks.map((week) => ({
    ...week,
    id: plan.weeks.find((candidate) => candidate.startDate === week.startDate)?.id ?? id(),
    index: plan.weeks.find((candidate) => candidate.startDate === week.startDate)?.index
      ?? Math.floor((new Date(`${week.startDate}T00:00:00Z`).getTime() - new Date(`${plan.block.startDate}T00:00:00Z`).getTime()) / (7 * DAY_MS)) + 1,
    workouts: week.workouts.map((draft) => {
      const prior = existing.get(draft.id)
      if (prior && samePrescription(draft, prior)) return prior
      return normalizeWorkout(draft, trigger, createdAt, decisionId, prior?.id ?? id(), (prior?.revision ?? 0) + 1, prior ? 'adjusted' : 'prescribed')
    }),
  }))
}

function materializeChanges(
  advice: AdvisorRecommendation,
  plan: CoachingPlan,
  trigger: 'post_activity' | 'weekly_review',
  effectiveDate: string,
  createdAt: string,
  decisionId: string,
  id: () => string,
): CoachPlanChange[] {
  if (advice.outcome === 'KEEP') return []
  if (advice.outcome === 'REPLAN') {
    const replacement = advice.changes[0]
    if (!replacement || replacement.kind !== 'replace_future' || advice.changes.length !== 1) {
      throw new Error('REPLAN advice must contain exactly one replace_future change')
    }
    return [{
      kind: 'replace_future',
      effectiveDate,
      beforeWeeks: getFutureSnapshot(plan, effectiveDate),
      afterWeeks: normalizeWeeks(replacement.weeks, plan, trigger, createdAt, decisionId, id),
    }]
  }

  return advice.changes.map((change): CoachPlanChange => {
    if (change.kind === 'replace_future') throw new Error('ADJUST advice cannot replace the future plan')
    if (change.kind === 'cancel_workout') {
      const before = findWorkout(plan, change.workoutId)
      return {
        kind: 'cancel_workout',
        before,
        after: normalizeWorkout(before, trigger, createdAt, decisionId, before.id, before.revision + 1, 'cancelled'),
      }
    }
    const before = change.workoutId ? findWorkout(plan, change.workoutId) : null
    return {
      kind: 'upsert_workout',
      before,
      after: normalizeWorkout(
        change.workout,
        trigger,
        createdAt,
        decisionId,
        before?.id ?? id(),
        (before?.revision ?? 0) + 1,
        before ? 'adjusted' : 'prescribed',
      ),
    }
  })
}

function decisionFromAdvice(
  advice: AdvisorRecommendation,
  plan: CoachingPlan,
  trigger: 'post_activity' | 'weekly_review',
  effectiveDate: string,
  createdAt: string,
  decisionId: string,
  id: () => string,
): CoachDecision {
  return parseCoachDecision({
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: decisionId,
    outcome: advice.outcome,
    trigger,
    createdAt,
    effectiveDate,
    planId: plan.id,
    basePlanRevision: plan.revision,
    resultPlanRevision: advice.outcome === 'KEEP' ? plan.revision : plan.revision + 1,
    reasonCodes: advice.reasonCodes,
    summary: advice.summary,
    evidence: advice.evidence,
    changes: materializeChanges(advice, plan, trigger, effectiveDate, createdAt, decisionId, id),
    provenance: provenance(trigger, createdAt),
  })
}

function firstIntensityTarget(blocks: WorkoutBlock[]): Pick<AggregateWorkoutComparison, 'plannedPaceSecPerKm' | 'plannedHrBpm'> {
  const segments = blocks.flatMap((block) => block.kind === 'repeat' ? block.steps : [block])
  const effort = segments.find((segment) => segment.kind === 'effort')
  return {
    ...(effort?.target.paceSecPerKm ? { plannedPaceSecPerKm: effort.target.paceSecPerKm } : {}),
    ...(effort?.target.hrBpm ? { plannedHrBpm: effort.target.hrBpm } : {}),
  }
}

function matchPrescription(plan: CoachingPlan, activity: Activity): { prescription: WorkoutPrescription | null; status: WorkoutEvaluation['matchStatus'] } {
  const sameDate = plan.weeks.flatMap((week) => week.workouts).filter((workout) => workout.status !== 'cancelled' && workout.date === activity.date.slice(0, 10))
  const matched = sameDate.find((workout) => COACHING_TO_ACTIVITY_TYPE[workout.type] === activity.type)
  if (matched) return { prescription: matched, status: 'matched' }
  return sameDate[0] ? { prescription: sameDate[0], status: 'date_only' } : { prescription: null, status: 'unmatched' }
}

function evaluationFor(
  plan: CoachingPlan,
  activity: Activity,
  decision: CoachDecision,
  contextHash: string,
  createdAt: string,
  id: () => string,
): WorkoutEvaluation {
  const { prescription, status } = matchPrescription(plan, activity)
  const comparable = status === 'matched' && prescription
  return parseWorkoutEvaluation({
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: id(),
    activityId: activity.id,
    activityDate: activity.date.slice(0, 10),
    prescriptionId: prescription?.id ?? null,
    planId: plan.id,
    planRevision: plan.revision,
    matchStatus: status,
    ...(comparable
      ? {
          comparison: {
            ...(prescription.totalDistanceMeters ? { plannedDistanceMeters: prescription.totalDistanceMeters } : {}),
            actualDistanceMeters: Math.round(activity.distanceKm * 1_000),
            ...(prescription.totalDurationSeconds ? { plannedDurationSeconds: prescription.totalDurationSeconds } : {}),
            actualDurationSeconds: activity.durationSeconds,
            ...firstIntensityTarget(prescription.blocks),
            ...(activity.paceSecPerKm ? { actualPaceSecPerKm: Math.round(activity.paceSecPerKm) } : {}),
            ...(activity.avgHeartRate ? { actualAvgHrBpm: activity.avgHeartRate } : {}),
          },
        }
      : {}),
    decisionId: decision.id,
    summary: decision.summary,
    createdAt,
    contextHash,
    provenance: provenance('post_activity', createdAt, decision.id),
  })
}

export async function createBootstrapProposal(
  context: CoachingContext,
  availableWeekdays: number[],
  services: WorkflowServices,
  targetEventId?: string,
): Promise<CoachingProposal> {
  if (services.repository.getCurrentPlan()) throw new Error('A current coaching plan already exists')
  if (availableWeekdays.length === 0) throw new Error('At least one available weekday is required')
  const now = services.now?.() ?? new Date()
  const id = services.id ?? defaultId
  const createdAt = now.toISOString()
  const draft = await services.advisor.bootstrap({ context, availableWeekdays, targetEventId })
  const proposedPlan = normalizeBootstrapPlan(draft, context, availableWeekdays, targetEventId, createdAt, id)
  const decisionId = id()
  const decision = parseCoachDecision({
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: decisionId,
    outcome: 'REPLAN',
    trigger: 'bootstrap',
    createdAt,
    effectiveDate: context.referenceDate,
    planId: proposedPlan.id,
    basePlanRevision: null,
    resultPlanRevision: 1,
    reasonCodes: ['INITIAL_PLAN'],
    summary: `Created the initial four-week block for ${proposedPlan.targetEvent.name}.`,
    evidence: [],
    changes: [{ kind: 'replace_future', effectiveDate: context.referenceDate, beforeWeeks: [], afterWeeks: proposedPlan.weeks }],
    provenance: provenance('bootstrap', createdAt),
  })
  return {
    schemaVersion: 1,
    id: id(),
    kind: 'bootstrap',
    createdAt,
    referenceDate: context.referenceDate,
    contextHash: coachingContextHash(context),
    basePlanId: null,
    basePlanRevision: null,
    proposedPlan,
    decision,
  }
}

async function createAdaptationProposal(
  kind: 'post_activity' | 'weekly_review',
  context: CoachingContext,
  services: WorkflowServices,
  activity?: Activity,
): Promise<CoachingProposal> {
  const plan = services.repository.getCurrentPlan()
  if (!plan) throw new Error('No current coaching plan exists')
  const now = services.now?.() ?? new Date()
  const id = services.id ?? defaultId
  const createdAt = now.toISOString()
  const dayAfterActivity = activity
    ? new Date(new Date(`${activity.date.slice(0, 10)}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10)
    : null
  const effectiveDate = kind === 'post_activity' && dayAfterActivity
    ? [dayAfterActivity, now.toISOString().slice(0, 10)].sort().at(-1)!
    : context.referenceDate
  const matched = activity ? matchPrescription(plan, activity).prescription : null
  const advice = kind === 'post_activity' && activity
    ? await services.advisor.evaluateActivity({ context, activity, prescription: matched })
    : await services.advisor.reviewWeek({ context })
  const decision = decisionFromAdvice(advice, plan, kind, effectiveDate, createdAt, id(), id)
  // Dry-run the lifecycle before a preview can be written. This catches stale
  // snapshots, past edits, bad workout revisions, and invalid replacement
  // horizons without mutating the repository.
  applyCoachDecision(plan, decision)
  const hash = coachingContextHash(context)
  const evaluation = activity ? evaluationFor(plan, activity, decision, hash, createdAt, id) : undefined
  return {
    schemaVersion: 1,
    id: id(),
    kind,
    createdAt,
    referenceDate: context.referenceDate,
    contextHash: hash,
    basePlanId: plan.id,
    basePlanRevision: plan.revision,
    decision,
    ...(evaluation ? { evaluation } : {}),
  }
}

export function createPostActivityProposal(
  context: CoachingContext,
  activity: Activity,
  services: WorkflowServices,
): Promise<CoachingProposal> {
  return createAdaptationProposal('post_activity', context, services, activity)
}

export function createWeeklyReviewProposal(context: CoachingContext, services: WorkflowServices): Promise<CoachingProposal> {
  return createAdaptationProposal('weekly_review', context, services)
}

function nextState(previous: CoachState | null, proposal: CoachingProposal, plan: CoachingPlan): CoachState {
  const createdAt = proposal.createdAt
  return {
    schemaVersion: COACHING_SCHEMA_VERSION,
    activePlanId: plan.id,
    activePlanRevision: plan.revision,
    lastDecisionId: proposal.decision.id,
    lastBootstrapAt: proposal.kind === 'bootstrap' ? createdAt : previous?.lastBootstrapAt ?? null,
    lastPostActivityAt: proposal.kind === 'post_activity' ? createdAt : previous?.lastPostActivityAt ?? null,
    lastWeeklyReviewAt: proposal.kind === 'weekly_review' ? createdAt : previous?.lastWeeklyReviewAt ?? null,
    updatedAt: createdAt,
  }
}

export function applyCoachingProposal(
  proposal: CoachingProposal,
  repository: CoachingRepository,
  currentContextHash: string,
): CoachingPlan {
  const validated = parseCoachingProposal(proposal)
  if (validated.contextHash !== currentContextHash) throw new Error('The coaching proposal is stale because its context changed')
  const current = repository.getCurrentPlan()
  if (validated.basePlanId !== (current?.id ?? null) || validated.basePlanRevision !== (current?.revision ?? null)) {
    throw new Error('The coaching proposal is stale because the current plan revision changed')
  }
  const result = validated.kind === 'bootstrap'
    ? parseCoachingPlan(validated.proposedPlan)
    : current
      ? applyCoachDecision(current, validated.decision)
      : (() => { throw new Error('No current coaching plan exists') })()

  repository.saveCurrentPlan(result)
  repository.saveDecision(validated.decision)
  if (validated.evaluation) repository.saveEvaluation(validated.evaluation)
  repository.saveState(nextState(repository.getState(), validated, result))
  return result
}
