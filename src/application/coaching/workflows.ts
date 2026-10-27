import { createHash } from 'crypto'
import { appTodayIso, DAY_MS } from '@/lib/calendarDate'
import { validateTrainingFrequency } from './frequency'
import { validateAdaptation, validateBootstrapDraft } from './draftRules'
import type { Activity } from '@/domain/activity/types'
import {
  COACHING_SCHEMA_VERSION,
  type CoachDecision,
  type CoachPlanChange,
  type CoachState,
  type CoachingEventRole,
  type CoachingPlan,
  type CoachingProvenance,
  type AggregateWorkoutComparison,
  type NumberRange,
  type TargetEvent,
  type TrainingGoal,
  type TrainingWeek,
  type WorkoutBlock,
  type WorkoutEvaluation,
  type WorkoutPrescription,
} from '@/domain/coaching/types'
import { applyCoachDecision, getFutureSnapshot } from '@/domain/coaching/lifecycle'
import { sessionForRun } from '@/domain/coaching/sessionForRun'
import { isoWeekWindows, weekWindowIndex } from '@/domain/coaching/weekWindows'
import { raceDistanceMeters } from '@/domain/coaching/raceTarget'
import { raceKey } from '@/domain/goals/entries'
import { BOOTSTRAP_START_WINDOW_DAYS } from '@/domain/coaching/renewal'
import { GENERAL_PREPARATION, macrocycleOf, resolveMacrocycleStart } from '@/domain/coaching/macrocycle'
import { blockGuideProposals, fatigueBasis, lighterWeekSessions, lighterWorkout, withGuide, type FatigueReading, type GuideProposal } from './autoregulation'
import { parseCoachDecision, parseCoachingPlan, parseWorkoutEvaluation } from '@/domain/coaching/validation'
import type { CoachingRepository } from '@/application/ports/CoachingRepository'
import type { AdvisorRecommendation, CoachingAdvisor, CoachingPlanDraft } from '@/application/ports/CoachingAdvisor'
import { coachingContextHash, type CoachingContext } from './context'
import type { CoachingProposal } from './proposal'
import { parseCoachingProposal } from './proposal'

const PROMPT_VERSION = 'coaching-v2'
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

type Source = CoachingProvenance['source']
type AdaptationTrigger = 'post_activity' | 'weekly_review' | 'autoregulation'

/** An advisor that does not say is the Gemini one. */
function sourceOf(services: WorkflowServices): Source {
  return services.advisor.source ?? 'gemini'
}

function provenance(source: Source, trigger: CoachingProvenance['trigger'], createdAt: string, decisionId?: string): CoachingProvenance {
  return {
    source,
    trigger,
    createdAt,
    promptVersion: PROMPT_VERSION,
    ...(decisionId ? { decisionId } : {}),
  }
}

const guidanceHash = (guidance: string) => createHash('sha256').update(guidance).digest('hex').slice(0, 24)

function eventFromRace(race: CoachingContext['upcomingRaces'][number], role: CoachingEventRole): TargetEvent {
  const distanceMeters = raceDistanceMeters(race.distance)
  return {
    id: raceKey(race),
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
  /** Null for general preparation. */
  primary: TargetEvent | null
  tuneUps: TargetEvent[]
  planningStartDate: string
  horizonEndDate: string
}

function selectBootstrapTarget(context: CoachingContext, targetEventId?: string, general = false, start?: string): BootstrapTargetStrategy {
  if (general && targetEventId) throw new Error('A general block has no target race; drop --race or --general')
  const reference = new Date(`${context.referenceDate}T00:00:00Z`)
  const races = context.upcomingRaces
    .filter((race) => race.date >= context.referenceDate)
    .sort((left, right) => left.date.localeCompare(right.date))
  const hasPendingSameDayRace = races.some((race) => race.date === context.referenceDate)
  const completedRaceToday = context.recentActivities.some(
    (activity) => activity.date === context.referenceDate && activity.type === 'Race',
  )
  const earliestStart = completedRaceToday && !hasPendingSameDayRace
    ? new Date(reference.getTime() + DAY_MS).toISOString().slice(0, 10)
    : context.referenceDate
  if (start !== undefined) {
    const latest = new Date(reference.getTime() + BOOTSTRAP_START_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10)
    if (start < earliestStart || start > latest || new Date(`${start}T00:00:00Z`).getUTCDay() !== 1) {
      throw new Error(`--start must be a Monday from ${earliestStart} to ${latest}, not ${start}`)
    }
  }
  const planningStartDate = start ?? earliestStart
  const planningStart = new Date(`${planningStartDate}T00:00:00Z`)
  const fullHorizonEnd = new Date(planningStart.getTime() + 27 * DAY_MS).toISOString().slice(0, 10)
  const overridden = targetEventId
    ? races.find((candidate) => {
        return raceKey(candidate) === targetEventId || candidate.name === targetEventId
      })
    : undefined
  if (targetEventId && !overridden) throw new Error(`Upcoming race not found: ${targetEventId}`)
  const nearest = races.find((race) => race.date >= planningStartDate)
  if (general || !nearest) {
    const tuneUps = races
      .filter((race) => race.date >= planningStartDate && race.date <= fullHorizonEnd)
      .map((race) => eventFromRace(race, 'tune_up'))
    return { primary: null, tuneUps, planningStartDate, horizonEndDate: fullHorizonEnd }
  }

  const garminPrimary = races.find((race) => race.isPrimaryEvent === true)
  let primaryRace = overridden ?? garminPrimary ?? nearest
  if (primaryRace.date < planningStartDate) {
    throw new Error(`${primaryRace.name} on ${primaryRace.date} falls before the block would start on ${planningStartDate}`)
  }
  if (!targetEventId && !garminPrimary) {
    const daysToNearest = Math.round((new Date(`${nearest.date}T00:00:00Z`).getTime() - reference.getTime()) / DAY_MS)
    const laterWithinHorizon = races.filter((race) => race.date > nearest.date && race.date <= fullHorizonEnd)
    if (daysToNearest <= NEAR_TERM_RACE_DAYS && laterWithinHorizon.length > 0) primaryRace = laterWithinHorizon.at(-1)!
  }

  const horizonEndDate = primaryRace.date < fullHorizonEnd ? primaryRace.date : fullHorizonEnd
  const tuneUps = races
    .filter((race) => race.date >= planningStartDate && race.date < primaryRace.date && race.date <= horizonEndDate)
    .map((race) => eventFromRace(race, 'tune_up'))
  return { primary: eventFromRace(primaryRace, 'primary'), tuneUps, planningStartDate, horizonEndDate }
}

function selectGoal(context: CoachingContext, event: TargetEvent | null): TrainingGoal {
  if (!event) return { kind: 'performance', description: 'Progress running fitness over time, with no target race.' }
  const eventYear = Number(event.date.slice(0, 4))
  const annualTarget = context.goals.find((year) => year.year === eventYear)?.targets.find((candidate) => candidate.distance === event.distanceLabel)
  const justFinish = context.upcomingRaces.some((race) => raceKey(race) === event.id && race.justFinish)
  const targetSeconds = justFinish ? undefined : event.targetSeconds ?? annualTarget?.targetSeconds
  return targetSeconds
    ? { kind: 'time', targetSeconds, description: `Run ${event.distanceLabel} in the target time.` }
    : { kind: 'finish', description: `Complete ${event.name}.` }
}

function calculatedTotals(blocks: WorkoutBlock[]): Pick<WorkoutPrescription, 'totalDurationSeconds' | 'totalDistanceMeters'> {
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

/** Kept exactly as written, ids and titles included: they were judged when they were written. */
function carriedWeeks(plan: CoachingPlan | null, from: string, before: string): TrainingWeek[] {
  if (!plan || before <= from) return []
  const lastDay = new Date(Date.parse(`${before}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10)
  return plan.weeks.flatMap((week) => {
    const workouts = week.workouts.filter((workout) => workout.date >= from && workout.date < before)
    if (workouts.length === 0) return []
    const startDate = week.startDate > from ? week.startDate : from
    const endDate = week.endDate < lastDay ? week.endDate : lastDay
    return [{ ...week, startDate, endDate, workouts }]
  })
}

/** Structure only - every rule a draft must satisfy has been checked by draftRules. */
function normalizeBootstrapPlan(
  draft: CoachingPlanDraft,
  context: CoachingContext,
  strategy: BootstrapTargetStrategy,
  createdAt: string,
  id: () => string,
  macrocycleStartDate: string,
  source: Source,
  carried: TrainingWeek[] = [],
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
  // Kept weeks take the first indexes; their workouts keep the ids they were written with, which carry
  // the outgoing plan's id.
  const keptWeeks = carried.map((week, weekIndex) => ({ ...week, id: `${planId}:week:${weekIndex + 1}`, index: weekIndex + 1 }))
  const normalizedWeeks = draft.weeks.map((week, draftIndex) => {
    const weekIndex = keptWeeks.length + draftIndex
    return {
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
      provenance: provenance(source, 'bootstrap', createdAt),
    })),
    }
  })
  for (const week of normalizedWeeks) {
    if (week.startDate < strategy.planningStartDate || week.endDate > horizonEnd) throw new Error(`${week.id} extends outside the selected target horizon`)
    for (const workout of week.workouts) {
      if (workout.date < strategy.planningStartDate || workout.date > horizonEnd) {
        throw new Error(`${workout.date} is outside the selected target horizon`)
      }
    }
  }
  const blockStart = keptWeeks[0]?.startDate ?? strategy.planningStartDate
  const guideProposals = strategy.primary ? [] : blockGuideProposals(context.autoregulation, normalizedWeeks.flatMap((week) => week.workouts))
  return parseCoachingPlan({
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: planId,
    revision: 1,
    status: 'active',
    // A new macrocycle opens with the block, kept days included, since a
    // macrocycle may not start after the block it contains.
    macrocycleStartDate: macrocycleStartDate < blockStart ? macrocycleStartDate : blockStart,
    ...(strategy.primary ? { targetEvent: strategy.primary } : {}),
    ...(strategy.tuneUps.length ? { tuneUpEvents: strategy.tuneUps } : {}),
    goal: selectGoal(context, strategy.primary),
    block: {
      id: `${planId}:block`,
      name: draft.name,
      startDate: blockStart,
      endDate: horizonEnd,
      focus: draft.focus,
      ...(guideProposals.length ? { guideProposals } : {}),
    },
    weeks: [...keptWeeks, ...normalizedWeeks],
    provenance: provenance(source, 'bootstrap', createdAt),
  })
}

function findWorkout(plan: CoachingPlan, workoutId: string): WorkoutPrescription {
  const workout = plan.weeks.flatMap((week) => week.workouts).find((candidate) => candidate.id === workoutId)
  if (!workout) throw new Error(`Prescription not found: ${workoutId}`)
  return workout
}

function normalizeWorkout(
  draft: WorkoutPrescription,
  source: Source,
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
    provenance: provenance(source, trigger, createdAt, decisionId),
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
  source: Source,
  trigger: CoachingProvenance['trigger'],
  createdAt: string,
  decisionId: string,
  id: () => string,
): TrainingWeek[] {
  // The model's ids are honoured only for future prescriptions being replaced: the past is fixed, so an id
  // naming a past one gets a new prescription with an id of our own.
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
        return normalizeWorkout(draft, source, trigger, createdAt, decisionId, prior?.id ?? id(), (prior?.revision ?? 0) + 1, prior ? 'adjusted' : 'prescribed')
      }),
    }
  })
}

function materializeChanges(
  advice: AdvisorRecommendation,
  plan: CoachingPlan,
  source: Source,
  trigger: AdaptationTrigger,
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
      afterWeeks: normalizeWeeks(replacement.weeks, plan, effectiveDate, source, trigger, createdAt, decisionId, id),
    }]
  }

  return advice.changes.map((change): CoachPlanChange => {
    if (change.kind === 'replace_future') throw new Error('ADJUST advice cannot replace the future plan')
    if (change.kind === 'cancel_workout') {
      const before = findWorkout(plan, change.workoutId)
      return {
        kind: 'cancel_workout',
        before,
        after: normalizeWorkout(before, source, trigger, createdAt, decisionId, before.id, before.revision + 1, 'cancelled'),
      }
    }
    const before = change.workoutId ? findWorkout(plan, change.workoutId) : null
    return {
      kind: 'upsert_workout',
      before,
      after: normalizeWorkout(
        change.workout,
        source,
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
  source: Source,
  trigger: AdaptationTrigger,
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
    changes: materializeChanges(advice, plan, source, trigger, effectiveDate, createdAt, decisionId, id),
    provenance: provenance(source, trigger, createdAt),
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
  const workouts = plan.weeks.flatMap((week) => week.workouts)
  const matched = sessionForRun(activity, workouts.map((prescription) => ({ prescription, activityId: null })))
  if (matched) return { prescription: matched, status: 'matched' }
  const sameDate = workouts.find((workout) => workout.status !== 'cancelled' && workout.date === activity.date.slice(0, 10))
  return sameDate ? { prescription: sameDate, status: 'date_only' } : { prescription: null, status: 'unmatched' }
}

function evaluationFor(
  plan: CoachingPlan,
  activity: Activity,
  decision: CoachDecision,
  contextHash: string,
  createdAt: string,
  id: () => string,
  source: Source,
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
    provenance: provenance(source, 'post_activity', createdAt, decision.id),
  })
}

/** Drafts fail over wording as often as substance, so the complaint goes back with the next ask instead of the draft being thrown away. */
const REPAIR_ATTEMPTS = 2

async function draftUntilAccepted<Draft, Accepted>(
  ask: (extraGuidance?: string) => Promise<Draft>,
  review: (draft: Draft) => Accepted,
  what = 'plan',
): Promise<Accepted> {
  let complaint: string | undefined

  for (let attempt = 0; ; attempt++) {
    const draft = await ask(complaint)
    try {
      return review(draft)
    } catch (error) {
      if (attempt >= REPAIR_ATTEMPTS) throw error
      complaint = `Your previous answer was rejected: ${error instanceof Error ? error.message : String(error)}\nReturn a corrected ${what} that satisfies this exactly, changing nothing else.`
    }
  }
}

function withComplaint(guidance: string | undefined, complaint: string | undefined): { guidance?: string } {
  return guidance || complaint ? { guidance: [guidance, complaint].filter(Boolean).join('\n\n') } : {}
}

export async function createBootstrapProposal(
  context: CoachingContext,
  availableWeekdays: number[],
  services: WorkflowServices,
  targetEventId?: string,
  runsPerWeek?: number,
  guidance?: string,
  replace = false,
  general = false,
  start?: string,
): Promise<CoachingProposal> {
  const existing = services.repository.getCurrentPlan()
  if (existing && !replace) {
    throw new Error('A current coaching plan already exists; pass --replace to supersede it')
  }

  if (availableWeekdays.length === 0) throw new Error('At least one available weekday is required')
  validateTrainingFrequency(availableWeekdays, runsPerWeek)
  const now = services.now?.() ?? new Date()
  const id = services.id ?? defaultId
  const createdAt = now.toISOString()
  const strategy = selectBootstrapTarget(context, targetEventId, general, start)
  const carried = carriedWeeks(existing, context.referenceDate, strategy.planningStartDate)
  const macrocycleStartDate = resolveMacrocycleStart(
    services.repository.getState(),
    strategy.primary?.id ?? GENERAL_PREPARATION,
    strategy.planningStartDate,
  )

  const ask = (extraGuidance?: string) => services.advisor.bootstrap({
    context,
    availableWeekdays,
    runsPerWeek,
    ...withComplaint(guidance, extraGuidance),
    planningStartDate: strategy.planningStartDate,
    primaryTargetEvent: strategy.primary,
    tuneUpEvents: strategy.tuneUps,
    horizonEndDate: strategy.horizonEndDate,
    macrocycleStartDate,
    ...(targetEventId ? { targetEventId } : {}),
  })

  const review = (draft: CoachingPlanDraft) => {
    validateBootstrapDraft(draft, { availableWeekdays, runsPerWeek, context, events: strategy, ...(guidance ? { guidance } : {}) })
    return normalizeBootstrapPlan(draft, context, strategy, createdAt, id, macrocycleStartDate, sourceOf(services), carried)
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
    summary: proposedPlan.targetEvent
      ? `Created the initial training block for ${proposedPlan.targetEvent.name}.`
      : 'Created a general preparation block with no target race.',
    evidence: [],
    changes: [{ kind: 'replace_future', effectiveDate: strategy.planningStartDate, beforeWeeks: [], afterWeeks: proposedPlan.weeks }],
    provenance: {
      ...provenance(sourceOf(services), 'bootstrap', createdAt),
      ...(guidance ? { guidanceHash: guidanceHash(guidance) } : {}),
    },
  })
  return {
    schemaVersion: 1,
    id: id(),
    kind: 'bootstrap',
    createdAt,
    referenceDate: context.referenceDate,
    contextHash: coachingContextHash(context),
    // When replacing, the superseded plan, so the proposal goes stale if that plan moves under it.
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
    ? [dayAfterActivity, appTodayIso(now)].sort().at(-1)!
    : context.referenceDate
  const matched = activity ? matchPrescription(plan, activity).prescription : null
  const guidance = services.repository.getGuidance?.() ?? undefined
  const told = guidance ? { guidance } : {}
  const ask = (complaint?: string) => {
    const request = { context, effectiveDate, ...withComplaint(guidance, complaint) }
    return kind === 'post_activity' && activity
      ? services.advisor.evaluateActivity({ ...request, activity, prescription: matched })
      : services.advisor.reviewWeek(request)
  }
  const review = (advice: AdvisorRecommendation) => {
    const decision = decisionFromAdvice(advice, plan, sourceOf(services), kind, effectiveDate, createdAt, id(), id)
    validateAdaptation(plan, applyCoachDecision(plan, decision), context, told)
    return decision
  }
  const decision = await draftUntilAccepted(ask, review, 'recommendation')
  const hash = coachingContextHash(context)
  const evaluation = activity ? evaluationFor(plan, activity, decision, hash, createdAt, id, sourceOf(services)) : undefined
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

export type AutoregulationChange =
  | { kind: 'pace_guide'; proposal: GuideProposal }
  | { kind: 'lighter_week'; fatigue: FatigueReading }

const paceLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
const rangeLabel = (range: NumberRange) => `${paceLabel(range.min)}-${paceLabel(range.max)}`

function guideAdvice(plan: CoachingPlan, proposal: GuideProposal, effectiveDate: string): AdvisorRecommendation {
  const changes = plan.weeks
    .flatMap((week) => week.workouts)
    .filter((workout) => workout.date >= effectiveDate)
    .flatMap((workout) => {
      const moved = withGuide(workout, proposal.guide, proposal.proposedGuide)
      return moved ? [{ kind: 'upsert_workout' as const, workoutId: workout.id, workout: moved }] : []
    })
  const verb = proposal.direction === 'faster' ? 'Take' : 'Add'
  return {
    outcome: 'ADJUST',
    reasonCodes: [proposal.direction === 'faster' ? 'THRESHOLD_HR_UNDER_TARGET' : 'THRESHOLD_HR_OVER_TARGET'],
    summary: `${verb} ${proposal.stepSecPerKm} s/km ${proposal.direction === 'faster' ? 'off' : 'to'} the ${proposal.repClass}-repetition controlled threshold guide: ${rangeLabel(proposal.guide)} becomes ${rangeLabel(proposal.proposedGuide)}.`,
    evidence: proposal.sessions.map((session) => ({
      code: 'THRESHOLD_SESSION',
      message: `${session.date}: heart rate from minute 3 ${session.reps.map((rep) => rep.windowHr).join('/')} bpm at ${session.reps.map((rep) => paceLabel(rep.paceSecPerKm)).join('/')}${session.tempC === null ? '' : `, ${session.tempC} °C`} - ${session.verdict}`,
    })),
    changes,
  }
}

function lighterWeekAdvice(plan: CoachingPlan, fatigue: FatigueReading, referenceDate: string): AdvisorRecommendation {
  const changes = lighterWeekSessions(plan, fatigue.run.date, referenceDate).flatMap((workout) => {
    const lighter = lighterWorkout(workout)
    if (!lighter) return []
    const recounted: WorkoutPrescription = { ...lighter }
    delete recounted.totalDistanceMeters
    delete recounted.totalDurationSeconds
    return [{ kind: 'upsert_workout' as const, workoutId: workout.id, workout: { ...recounted, ...calculatedTotals(recounted.blocks) } }]
  })
  const { run } = fatigue
  const gap = run.gapSecPerKm === null ? '' : ` (${paceLabel(Math.round(run.gapSecPerKm))} grade-adjusted)`
  const temperature = run.tempC === null ? '' : `, ${run.tempC} °C`
  return {
    outcome: 'ADJUST',
    reasonCodes: ['EASY_RUN_HR_ABOVE_NORMAL'],
    summary: `A lighter week: easy-run heart rate is ${Math.round(fatigue.run.hr - fatigue.normalHr!)} bpm above the recent normal. Controlled threshold time down by about a third, easy running by about a fifth, every run kept.`,
    evidence: [{
      code: 'EASY_RUN_HR',
      message: `${run.date}: ${run.hr} bpm at ${paceLabel(Math.round(run.paceSecPerKm))}${gap}${temperature}, against a normal of ${fatigue.normalHr} bpm over ${fatigue.comparables} runs at similar ${fatigueBasis(fatigue)}`,
      value: fatigue.run.hr - fatigue.normalHr!,
      unit: 'bpm',
    }],
    changes,
  }
}

/** Written as a proposal, never applied here: the athlete reads it and applies it, as any other. */
export function createAutoregulationProposal(
  context: CoachingContext,
  services: Omit<WorkflowServices, 'advisor'>,
  change: AutoregulationChange,
): CoachingProposal | null {
  const plan = services.repository.getCurrentPlan()
  if (!plan) throw new Error('No current coaching plan exists')
  if (change.kind === 'lighter_week' && (!change.fatigue.flagged || change.fatigue.normalHr === null)) return null
  const now = services.now?.() ?? new Date()
  const id = services.id ?? defaultId
  const createdAt = now.toISOString()
  const effectiveDate = new Date(Date.parse(`${context.referenceDate}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10)
  const advice = change.kind === 'pace_guide'
    ? guideAdvice(plan, change.proposal, effectiveDate)
    : lighterWeekAdvice(plan, change.fatigue, context.referenceDate)
  if (advice.changes.length === 0) return null

  const decision = decisionFromAdvice(advice, plan, 'autoregulation', 'autoregulation', effectiveDate, createdAt, id(), id)
  validateAdaptation(plan, applyCoachDecision(plan, decision), context, { guideChange: change.kind === 'pace_guide' })
  return {
    schemaVersion: 1,
    id: id(),
    kind: 'autoregulation',
    createdAt,
    referenceDate: context.referenceDate,
    contextHash: coachingContextHash(context),
    basePlanId: plan.id,
    basePlanRevision: plan.revision,
    decision,
  }
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
