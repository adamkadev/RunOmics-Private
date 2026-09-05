import { validateTrainingFrequency, validateDraftFrequency } from './frequency'
import type { Activity } from '@/domain/activity/types'
import {
  COACHING_SCHEMA_VERSION,
  COACHING_TO_ACTIVITY_TYPE,
  type CoachDecision,
  type CoachPlanChange,
  type CoachState,
  type CoachingEventRole,
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
import { raceDistanceMeters } from '@/domain/coaching/raceTarget'
import { parseCoachDecision, parseCoachingPlan, parseWorkoutEvaluation } from '@/domain/coaching/validation'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import type { AdvisorRecommendation, CoachingAdvisor, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import { coachingContextHash, type CoachingContext } from './context'
import { validateBootstrapDraftSemantics } from './bootstrapValidation'
import type { CoachingProposal } from './proposal'
import { parseCoachingProposal } from './proposal'

const PROMPT_VERSION = 'coaching-v1'
const DAY_MS = 86_400_000
const NEAR_TERM_RACE_DAYS = 7

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

function raceIdentity(race: CoachingContext['upcomingRaces'][number]): string {
  return race.garminEventUuid
    ?? (race.garminEventId === undefined ? `${race.date}:${race.name}` : String(race.garminEventId))
}

function eventFromRace(race: CoachingContext['upcomingRaces'][number], role: CoachingEventRole): TargetEvent {
  const distanceMeters = raceDistanceMeters(race.distance)
  return {
    id: raceIdentity(race),
    name: race.name,
    date: race.date,
    role,
    distanceLabel: race.distance,
    ...(distanceMeters === undefined ? {} : { distanceMeters }),
    ...(race.location ? { location: race.location } : {}),
    ...(race.courseContext ? { courseContext: race.courseContext } : {}),
    ...(race.targetSeconds === undefined ? {} : { targetSeconds: race.targetSeconds }),
  }
}

interface BootstrapTargetStrategy {
  primary: TargetEvent
  tuneUps: TargetEvent[]
  planningStartDate: string
  horizonEndDate: string
}

function selectBootstrapTarget(context: CoachingContext, targetEventId?: string): BootstrapTargetStrategy {
  const reference = new Date(`${context.referenceDate}T00:00:00Z`)
  const races = context.upcomingRaces
    .filter((race) => race.date >= context.referenceDate)
    .sort((left, right) => left.date.localeCompare(right.date))
  const hasPendingSameDayRace = races.some((race) => race.date === context.referenceDate)
  const completedRaceToday = context.recentActivities.some(
    (activity) => activity.date === context.referenceDate && activity.type === 'Race',
  )
  const planningStartDate = completedRaceToday && !hasPendingSameDayRace
    ? new Date(reference.getTime() + DAY_MS).toISOString().slice(0, 10)
    : context.referenceDate
  const planningStart = new Date(`${planningStartDate}T00:00:00Z`)
  const fullHorizonEnd = new Date(planningStart.getTime() + 27 * DAY_MS).toISOString().slice(0, 10)
  const overridden = targetEventId
    ? races.find((candidate) => {
        return raceIdentity(candidate) === targetEventId || candidate.name === targetEventId
      })
    : undefined
  if (targetEventId && !overridden) throw new Error(`Upcoming race not found: ${targetEventId}`)
  const nearest = races[0]
  if (!nearest) throw new Error('No upcoming race is available for bootstrap')

  const garminPrimary = races.find((race) => race.isPrimaryEvent === true)
  let primaryRace = overridden ?? garminPrimary ?? nearest
  if (!targetEventId && !garminPrimary) {
    const daysToNearest = Math.round((new Date(`${nearest.date}T00:00:00Z`).getTime() - reference.getTime()) / DAY_MS)
    const laterWithinHorizon = races.filter((race) => race.date > nearest.date && race.date <= fullHorizonEnd)
    if (daysToNearest <= NEAR_TERM_RACE_DAYS && laterWithinHorizon.length > 0) primaryRace = laterWithinHorizon.at(-1)!
  }

  const horizonEndDate = primaryRace.date < fullHorizonEnd ? primaryRace.date : fullHorizonEnd
  const tuneUps = races
    .filter((race) => race.date < primaryRace.date && race.date <= horizonEndDate)
    .map((race) => eventFromRace(race, 'tune_up'))
  return { primary: eventFromRace(primaryRace, 'primary'), tuneUps, planningStartDate, horizonEndDate }
}

function selectGoal(context: CoachingContext, event: TargetEvent): TrainingGoal {
  const eventYear = Number(event.date.slice(0, 4))
  const annualTarget = context.goals.find((year) => year.year === eventYear)?.targets.find((candidate) => candidate.distance === event.distanceLabel)
  const targetSeconds = event.targetSeconds ?? annualTarget?.targetSeconds
  return targetSeconds
    ? { kind: 'time', targetSeconds, description: `Run ${event.distanceLabel} in the target time.` }
    : { kind: 'finish', description: `Complete ${event.name}.` }
}

function normalizeBootstrapPlan(
  draft: CoachingPlanDraft,
  context: CoachingContext,
  availableWeekdays: number[],
  strategy: BootstrapTargetStrategy,
  createdAt: string,
  id: () => string,
): CoachingPlan {
  validateBootstrapDraftSemantics(draft, strategy, context)
  const planningStart = new Date(`${strategy.planningStartDate}T00:00:00Z`)
  const horizonEnd = strategy.horizonEndDate
  const horizonDays = Math.round((new Date(`${horizonEnd}T00:00:00Z`).getTime() - planningStart.getTime()) / DAY_MS) + 1
  const expectedWeeks = Math.ceil(horizonDays / 7)
  if (draft.weeks.length !== expectedWeeks) throw new Error(`Bootstrap must produce exactly ${expectedWeeks} week${expectedWeeks === 1 ? '' : 's'} for the selected target horizon`)
  const planId = id()
  const calculatedTotals = (blocks: WorkoutBlock[]) => {
    const segments = blocks.flatMap((block) => block.kind === 'repeat'
      ? block.steps.map((step) => ({ segment: step, multiplier: block.repetitions }))
      : [{ segment: block, multiplier: 1 }])
    const allDuration = segments.every(({ segment }) => segment.target.durationSeconds !== undefined)
    const allDistance = segments.every(({ segment }) => segment.target.distanceMeters !== undefined)
    return {
      ...(allDuration ? { totalDurationSeconds: segments.reduce((sum, { segment, multiplier }) => sum + segment.target.durationSeconds! * multiplier, 0) } : {}),
      ...(allDistance ? { totalDistanceMeters: segments.reduce((sum, { segment, multiplier }) => sum + segment.target.distanceMeters! * multiplier, 0) } : {}),
    }
  }
  const normalizedWeeks = draft.weeks.map((week, weekIndex) => ({
    id: `${planId}:week:${weekIndex + 1}`,
    index: weekIndex + 1,
    startDate: week.startDate,
    endDate: week.endDate,
    focus: week.focus,
    workouts: week.workouts.map((workout, workoutIndex) => ({
      ...workout,
      ...calculatedTotals(workout.blocks),
      id: `${planId}:workout:${weekIndex + 1}:${workoutIndex + 1}`,
      revision: 1,
      status: 'prescribed' as const,
      provenance: provenance('bootstrap', createdAt),
    })),
  }))
  for (const week of normalizedWeeks) {
    if (week.startDate < strategy.planningStartDate || week.endDate > horizonEnd) throw new Error(`${week.id} extends outside the selected target horizon`)
    for (const workout of week.workouts) {
      if (!availableWeekdays.includes(new Date(`${workout.date}T00:00:00Z`).getUTCDay())) {
        throw new Error(`${workout.date} is outside the available weekdays`)
      }
      if (workout.date < strategy.planningStartDate || workout.date > horizonEnd) {
        throw new Error(`${workout.date} is outside the selected target horizon`)
      }
    }
  }
  return parseCoachingPlan({
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: planId,
    revision: 1,
    status: 'active',
    targetEvent: strategy.primary,
    ...(strategy.tuneUps.length ? { tuneUpEvents: strategy.tuneUps } : {}),
    goal: selectGoal(context, strategy.primary),
    block: {
      id: `${planId}:block`,
      name: draft.name,
      startDate: strategy.planningStartDate,
      endDate: horizonEnd,
      focus: draft.focus,
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
  runsPerWeek?: number,
  guidance?: string,
): Promise<CoachingProposal> {
  if (services.repository.getCurrentPlan()) throw new Error('A current coaching plan already exists')
  if (availableWeekdays.length === 0) throw new Error('At least one available weekday is required')
  validateTrainingFrequency(availableWeekdays, runsPerWeek)
  const now = services.now?.() ?? new Date()
  const id = services.id ?? defaultId
  const createdAt = now.toISOString()
  const strategy = selectBootstrapTarget(context, targetEventId)
  const draft = await services.advisor.bootstrap({
    context,
    availableWeekdays,
    runsPerWeek,
    ...(guidance ? { guidance } : {}),
    planningStartDate: strategy.planningStartDate,
    primaryTargetEvent: strategy.primary,
    tuneUpEvents: strategy.tuneUps,
    horizonEndDate: strategy.horizonEndDate,
    ...(targetEventId ? { targetEventId } : {}),
  })
  validateDraftFrequency(draft, runsPerWeek)
  const proposedPlan = normalizeBootstrapPlan(draft, context, availableWeekdays, strategy, createdAt, id)
  proposedPlan.trainingPreferences = { availableWeekdays, ...(runsPerWeek === undefined ? {} : { runsPerWeek }) }
  const decisionId = id()
  const decision = parseCoachDecision({
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: decisionId,
    outcome: 'REPLAN',
    trigger: 'bootstrap',
    createdAt,
    effectiveDate: strategy.planningStartDate,
    planId: proposedPlan.id,
    basePlanRevision: null,
    resultPlanRevision: 1,
    reasonCodes: ['INITIAL_PLAN'],
    summary: `Created the initial training block for ${proposedPlan.targetEvent.name}.`,
    evidence: [],
    changes: [{ kind: 'replace_future', effectiveDate: strategy.planningStartDate, beforeWeeks: [], afterWeeks: proposedPlan.weeks }],
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
