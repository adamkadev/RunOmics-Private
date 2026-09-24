import { validateTrainingFrequency } from './frequency'
import { validateAdaptation, validateBootstrapDraft } from './draftRules'
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
import { isoWeekWindows, weekWindowIndex } from '@/domain/coaching/weekWindows'
import { raceDistanceMeters } from '@/domain/coaching/raceTarget'
import { macrocycleOf, resolveMacrocycleStart } from '@/domain/coaching/macrocycle'
import { parseCoachDecision, parseCoachingPlan, parseWorkoutEvaluation } from '@/domain/coaching/validation'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import type { AdvisorRecommendation, CoachingAdvisor, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import { coachingContextHash, type CoachingContext } from './context'
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

/** Structure only - every rule a draft must satisfy has been checked by draftRules. */
function normalizeBootstrapPlan(
  draft: CoachingPlanDraft,
  context: CoachingContext,
  strategy: BootstrapTargetStrategy,
  createdAt: string,
  id: () => string,
  macrocycleStartDate: string,
): CoachingPlan {
  const horizonEnd = strategy.horizonEndDate
  const windows = isoWeekWindows(strategy.planningStartDate, horizonEnd)
  if (draft.weeks.length !== windows.length) throw new Error(`Bootstrap must produce exactly ${windows.length} week${windows.length === 1 ? '' : 's'} for the selected target horizon`)
  draft.weeks.forEach((week, index) => {
    const expected = windows[index]!
    if (week.startDate !== expected.startDate || week.endDate !== expected.endDate) {
      throw new Error(`Bootstrap week ${index + 1} must run ${expected.startDate} to ${expected.endDate}, not ${week.startDate} to ${week.endDate}`)
    }
  })
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
    macrocycleStartDate,
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

function prescribedContent(prescription: WorkoutPrescription): Partial<WorkoutPrescription> {
  const content: Partial<WorkoutPrescription> = { ...prescription }
  delete content.id
  delete content.revision
  delete content.status
  delete content.provenance
  return content
}

function samePrescription(draft: WorkoutPrescription, prior: WorkoutPrescription): boolean {
  return JSON.stringify(prescribedContent(draft)) === JSON.stringify(prescribedContent(prior))
}

function normalizeWeeks(
  weeks: TrainingWeek[],
  plan: CoachingPlan,
  effectiveDate: string,
  trigger: CoachingProvenance['trigger'],
  createdAt: string,
  decisionId: string,
  id: () => string,
): TrainingWeek[] {
  // Identity is the model's claim, so it is honoured only where it can be
  // true: a prescription in the future being replaced. An id naming one that
  // is already past is not a continuation of it - the past is fixed - and the
  // draft is a new prescription with an id of our own.
  const existing = new Map(plan.weeks
    .flatMap((week) => week.workouts)
    .filter((workout) => workout.date >= effectiveDate)
    .map((workout) => [workout.id, workout]))

  return weeks.map((week) => {
    const priorWeek = plan.weeks.find((candidate) => candidate.startDate === week.startDate)
    const weeksIntoBlock = weekWindowIndex(isoWeekWindows(plan.block.startDate, plan.block.endDate), week.startDate)
      ?? plan.weeks.length + 1

    return {
      ...week,
      id: priorWeek?.id ?? id(),
      index: priorWeek?.index ?? weeksIntoBlock,
      workouts: week.workouts.map((draft) => {
        const prior = existing.get(draft.id)
        if (prior && samePrescription(draft, prior)) return prior
        return normalizeWorkout(draft, trigger, createdAt, decisionId, prior?.id ?? id(), (prior?.revision ?? 0) + 1, prior ? 'adjusted' : 'prescribed')
      }),
    }
  })
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
      afterWeeks: normalizeWeeks(replacement.weeks, plan, effectiveDate, trigger, createdAt, decisionId, id),
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

/**
 * Our own rules reject a draft over wording as often as over substance - a week
 * that says "freshness" where the validator wants "taper", a title using the
 * word progressive. Throwing the draft away leaves an expensive answer unused
 * and the model none the wiser, so the complaint goes back with the next ask.
 */
const REPAIR_ATTEMPTS = 2

async function draftUntilAccepted(
  ask: (extraGuidance?: string) => Promise<CoachingPlanDraft>,
  review: (draft: CoachingPlanDraft) => CoachingPlan,
): Promise<CoachingPlan> {
  let complaint: string | undefined

  for (let attempt = 0; ; attempt++) {
    const draft = await ask(complaint)
    try {
      return review(draft)
    } catch (error) {
      if (attempt >= REPAIR_ATTEMPTS) throw error
      complaint = `Your previous answer was rejected: ${error instanceof Error ? error.message : String(error)}\nReturn a corrected plan that satisfies this exactly, changing nothing else.`
    }
  }
}

export async function createBootstrapProposal(
  context: CoachingContext,
  availableWeekdays: number[],
  services: WorkflowServices,
  targetEventId?: string,
  runsPerWeek?: number,
  guidance?: string,
  replace = false,
): Promise<CoachingProposal> {
  // Bootstrap is how a block is written, and blocks are rewritten - a rejected
  // plan, a changed goal, a week that turned out wrong. Refusing outright left
  // deleting current_plan.json by hand as the only way through.
  const existing = services.repository.getCurrentPlan()
  if (existing && !replace) {
    throw new Error('A current coaching plan already exists; pass --replace to supersede it')
  }

  if (availableWeekdays.length === 0) throw new Error('At least one available weekday is required')
  validateTrainingFrequency(availableWeekdays, runsPerWeek)
  const now = services.now?.() ?? new Date()
  const id = services.id ?? defaultId
  const createdAt = now.toISOString()
  const strategy = selectBootstrapTarget(context, targetEventId)
  const macrocycleStartDate = resolveMacrocycleStart(
    services.repository.getState(),
    strategy.primary.id,
    strategy.planningStartDate,
  )

  const ask = (extraGuidance?: string) => services.advisor.bootstrap({
    context,
    availableWeekdays,
    runsPerWeek,
    ...(guidance || extraGuidance ? { guidance: [guidance, extraGuidance].filter(Boolean).join('\n\n') } : {}),
    planningStartDate: strategy.planningStartDate,
    primaryTargetEvent: strategy.primary,
    tuneUpEvents: strategy.tuneUps,
    horizonEndDate: strategy.horizonEndDate,
    macrocycleStartDate,
    ...(targetEventId ? { targetEventId } : {}),
  })

  const review = (draft: CoachingPlanDraft) => {
    validateBootstrapDraft(draft, { availableWeekdays, runsPerWeek, context, events: strategy })
    return normalizeBootstrapPlan(draft, context, strategy, createdAt, id, macrocycleStartDate)
  }

  const proposedPlan = await draftUntilAccepted(ask, review)
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
    // Null for a first block; when replacing, the plan being superseded, so
    // the proposal still goes stale if that plan moves under it.
    basePlanId: existing?.id ?? null,
    basePlanRevision: existing?.revision ?? null,
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
  // Judged on the plan it would produce, by the rules a bootstrap answers to:
  // until this, only the decision's own shape was checked.
  validateAdaptation(plan, applyCoachDecision(plan, decision), context)
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
    macrocycle: macrocycleOf(plan),
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

  // Superseding rather than revising: keep the outgoing plan before the file
  // is overwritten, so a regeneration can be walked back.
  if (current && current.id !== result.id) repository.archivePlan?.(current)
  repository.saveCurrentPlan(result)
  repository.saveDecision(validated.decision)
  if (validated.evaluation) repository.saveEvaluation(validated.evaluation)
  repository.saveState(nextState(repository.getState(), validated, result))
  return result
}
