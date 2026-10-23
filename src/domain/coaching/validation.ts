import { MAX_BOOTSTRAP_WEEKS } from './weekWindows'
import {
  COACHING_SCHEMA_VERSION,
  type CoachDecision,
  type CoachEvidence,
  type CoachPlanChange,
  type CoachState,
  type CoachingEventRole,
  type CoachingPlan,
  type CoachingProvenance,
  type NumberRange,
  type TargetEvent,
  type TrainingGoal,
  type TrainingWeek,
  type WorkoutBlock,
  type WorkoutEvaluation,
  type WorkoutNameStructure,
  type WorkoutPrescription,
  type WorkoutTarget,
} from './types'

export class CoachingValidationError extends Error {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'CoachingValidationError'
  }
}

type JsonObject = Record<string, unknown>

function object(value: unknown, path: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CoachingValidationError(path, 'expected an object')
  }
  return value as JsonObject
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CoachingValidationError(path, 'expected a non-empty string')
  }
  return value
}

function nullableString(value: unknown, path: string): string | null {
  return value === null ? null : string(value, path)
}

function number(value: unknown, path: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new CoachingValidationError(path, `expected a finite number >= ${minimum}`)
  }
  return value
}

function integer(value: unknown, path: string, minimum = 0): number {
  const parsed = number(value, path, minimum)
  if (!Number.isInteger(parsed)) throw new CoachingValidationError(path, 'expected an integer')
  return parsed
}

function enumeration<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new CoachingValidationError(path, `expected one of ${allowed.join(', ')}`)
  }
  return value as T
}

function array<T>(value: unknown, path: string, parser: (item: unknown, itemPath: string) => T): T[] {
  if (!Array.isArray(value)) throw new CoachingValidationError(path, 'expected an array')
  return value.map((item, index) => parser(item, `${path}[${index}]`))
}

function optionalStringArray(value: unknown, path: string): string[] | undefined {
  if (value === undefined) return undefined
  return array(value, path, string)
}

function schemaVersion(value: unknown, path: string): typeof COACHING_SCHEMA_VERSION {
  if (value !== COACHING_SCHEMA_VERSION) {
    throw new CoachingValidationError(path, `unsupported schema version ${String(value)}`)
  }
  return COACHING_SCHEMA_VERSION
}

function isoDate(value: unknown, path: string): string {
  const date = string(value, path)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new CoachingValidationError(path, 'expected YYYY-MM-DD')
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new CoachingValidationError(path, 'invalid calendar date')
  }
  return date
}

// The advisors read a model's answer with these too, so a reply and a file on
// disk are held to one idea of what an object, a string or a date is.
export {
  array as parseArray,
  enumeration as parseEnumeration,
  isoDate as parseIsoDate,
  object as parseObject,
  string as parseString,
}

function timestamp(value: unknown, path: string): string {
  const result = string(value, path)
  if (Number.isNaN(Date.parse(result))) throw new CoachingValidationError(path, 'expected an ISO timestamp')
  return result
}

function range(value: unknown, path: string): NumberRange {
  const raw = object(value, path)
  const min = number(raw.min, `${path}.min`, 1)
  const max = number(raw.max, `${path}.max`, 1)
  if (min > max) throw new CoachingValidationError(path, 'min must be <= max')
  return { min, max }
}

function provenance(value: unknown, path: string): CoachingProvenance {
  const raw = object(value, path)
  return {
    source: enumeration(raw.source, ['gemini', 'manual', 'demo', 'autoregulation'], `${path}.source`),
    trigger: enumeration(raw.trigger, ['bootstrap', 'post_activity', 'weekly_review', 'autoregulation'], `${path}.trigger`),
    createdAt: timestamp(raw.createdAt, `${path}.createdAt`),
    ...(raw.model === undefined ? {} : { model: string(raw.model, `${path}.model`) }),
    ...(raw.promptVersion === undefined ? {} : { promptVersion: string(raw.promptVersion, `${path}.promptVersion`) }),
    ...(raw.decisionId === undefined ? {} : { decisionId: string(raw.decisionId, `${path}.decisionId`) }),
    ...(raw.parentRevision === undefined ? {} : { parentRevision: integer(raw.parentRevision, `${path}.parentRevision`, 1) }),
  }
}

function workoutTarget(value: unknown, path: string): WorkoutTarget {
  const raw = object(value, path)
  const target: WorkoutTarget = {
    ...(raw.durationSeconds === undefined ? {} : { durationSeconds: integer(raw.durationSeconds, `${path}.durationSeconds`, 1) }),
    ...(raw.distanceMeters === undefined ? {} : { distanceMeters: integer(raw.distanceMeters, `${path}.distanceMeters`, 1) }),
    ...(raw.paceSecPerKm === undefined ? {} : { paceSecPerKm: range(raw.paceSecPerKm, `${path}.paceSecPerKm`) }),
    ...(raw.hrBpm === undefined ? {} : { hrBpm: range(raw.hrBpm, `${path}.hrBpm`) }),
    ...(raw.hrZone === undefined ? {} : { hrZone: integer(raw.hrZone, `${path}.hrZone`, 1) }),
  }
  if (target.hrZone !== undefined && target.hrZone > 5) {
    throw new CoachingValidationError(`${path}.hrZone`, 'must be between 1 and 5')
  }
  if (target.durationSeconds === undefined && target.distanceMeters === undefined) {
    throw new CoachingValidationError(path, 'durationSeconds or distanceMeters is required')
  }
  return target
}

function workoutBlock(value: unknown, path: string): WorkoutBlock {
  const raw = object(value, path)
  if (raw.kind === 'repeat') {
    const steps = array(raw.steps, `${path}.steps`, (step, stepPath) => {
      const parsed = workoutBlock(step, stepPath)
      if (parsed.kind === 'repeat') throw new CoachingValidationError(stepPath, 'nested repeat groups are not supported')
      return parsed
    })
    if (steps.length === 0) throw new CoachingValidationError(`${path}.steps`, 'must contain at least one step')
    return { kind: 'repeat', repetitions: integer(raw.repetitions, `${path}.repetitions`, 1), steps }
  }

  return {
    kind: enumeration(raw.kind, ['warmup', 'effort', 'recovery', 'cooldown', 'strides'], `${path}.kind`),
    target: workoutTarget(raw.target, `${path}.target`),
    ...(optionalStringArray(raw.notes, `${path}.notes`) ? { notes: optionalStringArray(raw.notes, `${path}.notes`) } : {}),
  }
}

/** "4:25": minutes and seconds per kilometre. */
const PACE_CLOCK = /^\d{1,2}:[0-5]\d$/

/**
 * Only the shape is checked here: whether the fields agree with the blocks is
 * application/coaching/workoutNames.ts's to judge, where the name is written.
 */
function nameStructure(value: unknown, path: string): WorkoutNameStructure {
  const raw = object(value, path)
  const repMinutes = raw.repMinutes === undefined ? undefined : number(raw.repMinutes, `${path}.repMinutes`)
  if (repMinutes === 0) throw new CoachingValidationError(`${path}.repMinutes`, 'expected a number > 0')
  const targetPace = raw.targetPace === undefined ? undefined : string(raw.targetPace, `${path}.targetPace`)
  if (targetPace !== undefined && !PACE_CLOCK.test(targetPace)) throw new CoachingValidationError(`${path}.targetPace`, 'expected M:SS')
  const structure: WorkoutNameStructure = {
    ...(raw.reps === undefined ? {} : { reps: integer(raw.reps, `${path}.reps`, 1) }),
    ...(repMinutes === undefined ? {} : { repMinutes }),
    ...(targetPace === undefined ? {} : { targetPace }),
    ...(raw.extras === undefined ? {} : { extras: array(raw.extras, `${path}.extras`, string) }),
  }
  if (Object.keys(structure).length === 0) throw new CoachingValidationError(path, 'states nothing; leave it out instead')
  return structure
}

export function parseWorkoutPrescription(value: unknown, path = 'workout'): WorkoutPrescription {
  const raw = object(value, path)
  const workout: WorkoutPrescription = {
    id: string(raw.id, `${path}.id`),
    revision: integer(raw.revision, `${path}.revision`, 1),
    date: isoDate(raw.date, `${path}.date`),
    type: enumeration(raw.type, ['easy', 'recovery', 'long_run', 'tempo', 'threshold', 'vo2max', 'anaerobic', 'sprint', 'race'], `${path}.type`),
    title: string(raw.title, `${path}.title`),
    ...(raw.shortName === undefined ? {} : { shortName: string(raw.shortName, `${path}.shortName`) }),
    ...(raw.structure === undefined ? {} : { structure: nameStructure(raw.structure, `${path}.structure`) }),
    description: string(raw.description, `${path}.description`),
    status: enumeration(raw.status, ['prescribed', 'adjusted', 'cancelled'], `${path}.status`),
    ...(raw.totalDurationSeconds === undefined ? {} : { totalDurationSeconds: integer(raw.totalDurationSeconds, `${path}.totalDurationSeconds`, 1) }),
    ...(raw.totalDistanceMeters === undefined ? {} : { totalDistanceMeters: integer(raw.totalDistanceMeters, `${path}.totalDistanceMeters`, 1) }),
    blocks: array(raw.blocks, `${path}.blocks`, workoutBlock),
    ...(optionalStringArray(raw.notes, `${path}.notes`) ? { notes: optionalStringArray(raw.notes, `${path}.notes`) } : {}),
    provenance: provenance(raw.provenance, `${path}.provenance`),
  }
  if (workout.blocks.length === 0) throw new CoachingValidationError(`${path}.blocks`, 'must contain at least one block')
  return workout
}

function trainingWeek(value: unknown, path: string): TrainingWeek {
  const raw = object(value, path)
  const week: TrainingWeek = {
    id: string(raw.id, `${path}.id`),
    index: integer(raw.index, `${path}.index`, 1),
    startDate: isoDate(raw.startDate, `${path}.startDate`),
    endDate: isoDate(raw.endDate, `${path}.endDate`),
    focus: string(raw.focus, `${path}.focus`),
    workouts: array(raw.workouts, `${path}.workouts`, parseWorkoutPrescription),
  }
  if (week.startDate > week.endDate) throw new CoachingValidationError(path, 'startDate must be <= endDate')
  for (const workout of week.workouts) {
    if (workout.date < week.startDate || workout.date > week.endDate) {
      throw new CoachingValidationError(`${path}.workouts`, `${workout.id} falls outside its week`)
    }
  }
  return week
}

function trainingGoal(value: unknown, path: string): TrainingGoal {
  const raw = object(value, path)
  const kind = enumeration(raw.kind, ['time', 'finish', 'performance'], `${path}.kind`)
  const description = string(raw.description, `${path}.description`)
  return kind === 'time'
    ? { kind, targetSeconds: integer(raw.targetSeconds, `${path}.targetSeconds`, 1), description }
    : { kind, description }
}

function targetEvent(value: unknown, path: string): TargetEvent {
  const raw = object(value, path)
  return {
    id: string(raw.id, `${path}.id`),
    name: string(raw.name, `${path}.name`),
    date: isoDate(raw.date, `${path}.date`),
    ...(raw.role === undefined ? {} : { role: enumeration<CoachingEventRole>(raw.role, ['primary', 'tune_up'], `${path}.role`) }),
    ...(raw.distanceLabel === undefined ? {} : { distanceLabel: string(raw.distanceLabel, `${path}.distanceLabel`) }),
    ...(raw.distanceMeters === undefined ? {} : { distanceMeters: integer(raw.distanceMeters, `${path}.distanceMeters`, 1) }),
    ...(raw.location === undefined ? {} : { location: string(raw.location, `${path}.location`) }),
    ...(raw.courseContext === undefined ? {} : { courseContext: raceCourseContext(raw.courseContext, `${path}.courseContext`) }),
    ...(raw.targetSeconds === undefined ? {} : { targetSeconds: integer(raw.targetSeconds, `${path}.targetSeconds`, 1) }),
  }
}

export function parseCoachingPlan(value: unknown, path = 'plan'): CoachingPlan {
  const raw = object(value, path)
  schemaVersion(raw.schemaVersion, `${path}.schemaVersion`)
  const blockRaw = object(raw.block, `${path}.block`)
  const plan: CoachingPlan = {
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: string(raw.id, `${path}.id`),
    revision: integer(raw.revision, `${path}.revision`, 1),
    status: enumeration(raw.status, ['active', 'completed', 'superseded'], `${path}.status`),
    block: {
      id: string(blockRaw.id, `${path}.block.id`),
      name: string(blockRaw.name, `${path}.block.name`),
      startDate: isoDate(blockRaw.startDate, `${path}.block.startDate`),
      endDate: isoDate(blockRaw.endDate, `${path}.block.endDate`),
      focus: string(blockRaw.focus, `${path}.block.focus`),
    },
    ...(raw.trainingPreferences === undefined ? {} : { trainingPreferences: trainingPreferences(raw.trainingPreferences) }),
    ...(raw.macrocycleStartDate === undefined
      ? {}
      : { macrocycleStartDate: isoDate(raw.macrocycleStartDate, `${path}.macrocycleStartDate`) }),
    ...(raw.targetEvent === undefined ? {} : { targetEvent: targetEvent(raw.targetEvent, `${path}.targetEvent`) }),
    ...(raw.tuneUpEvents === undefined ? {} : { tuneUpEvents: array(raw.tuneUpEvents, `${path}.tuneUpEvents`, targetEvent) }),
    goal: trainingGoal(raw.goal, `${path}.goal`),
    weeks: array(raw.weeks, `${path}.weeks`, trainingWeek),
    provenance: provenance(raw.provenance, `${path}.provenance`),
  }

  if (plan.block.startDate > plan.block.endDate) throw new CoachingValidationError(`${path}.block`, 'startDate must be <= endDate')
  if (plan.macrocycleStartDate !== undefined && plan.macrocycleStartDate > plan.block.startDate) {
    throw new CoachingValidationError(`${path}.macrocycleStartDate`, 'must not start after the training block')
  }
  const target = plan.targetEvent
  if (target && plan.block.endDate > target.date) throw new CoachingValidationError(`${path}.block.endDate`, 'training block cannot extend beyond the primary target event')
  if (target?.role !== undefined && target.role !== 'primary') throw new CoachingValidationError(`${path}.targetEvent.role`, 'targetEvent must be primary')
  if (plan.weeks.length === 0 || plan.weeks.length > MAX_BOOTSTRAP_WEEKS) throw new CoachingValidationError(`${path}.weeks`, `must contain 1 to ${MAX_BOOTSTRAP_WEEKS} weeks`)
  const ids = new Set<string>([plan.id, plan.block.id, ...(target ? [target.id] : [])])
  for (const [index, event] of (plan.tuneUpEvents ?? []).entries()) {
    if (event.role !== 'tune_up') throw new CoachingValidationError(`${path}.tuneUpEvents[${index}].role`, 'must be tune_up')
    // With no target, a supporting race is one the block passes through.
    if (event.date < plan.block.startDate || event.date > (target?.date ?? plan.block.endDate)) throw new CoachingValidationError(`${path}.tuneUpEvents[${index}].date`, 'must fall inside the block before the primary target')
    if (ids.has(event.id)) throw new CoachingValidationError(`${path}.tuneUpEvents`, `duplicate id ${event.id}`)
    ids.add(event.id)
  }
  const weekIndexes = new Set<number>()
  for (const week of plan.weeks) {
    if (ids.has(week.id)) throw new CoachingValidationError(`${path}.weeks`, `duplicate id ${week.id}`)
    ids.add(week.id)
    if (weekIndexes.has(week.index)) throw new CoachingValidationError(`${path}.weeks`, `duplicate week index ${week.index}`)
    weekIndexes.add(week.index)
    if (week.startDate < plan.block.startDate || week.endDate > plan.block.endDate) {
      throw new CoachingValidationError(`${path}.weeks`, `${week.id} falls outside the training block`)
    }
    for (const workout of week.workouts) {
      if (ids.has(workout.id)) throw new CoachingValidationError(`${path}.weeks`, `duplicate workout id ${workout.id}`)
      ids.add(workout.id)
    }
  }
  return plan
}

function evidence(value: unknown, path: string): CoachEvidence {
  const raw = object(value, path)
  const rawValue = raw.value
  if (rawValue !== undefined && typeof rawValue !== 'number' && typeof rawValue !== 'string') {
    throw new CoachingValidationError(`${path}.value`, 'expected a number or string')
  }
  return {
    code: string(raw.code, `${path}.code`),
    message: string(raw.message, `${path}.message`),
    ...(rawValue === undefined ? {} : { value: rawValue }),
    ...(raw.unit === undefined ? {} : { unit: string(raw.unit, `${path}.unit`) }),
  }
}

function planChange(value: unknown, path: string): CoachPlanChange {
  const raw = object(value, path)
  const kind = enumeration(raw.kind, ['upsert_workout', 'cancel_workout', 'replace_future'], `${path}.kind`)
  if (kind === 'replace_future') {
    return {
      kind,
      effectiveDate: isoDate(raw.effectiveDate, `${path}.effectiveDate`),
      beforeWeeks: array(raw.beforeWeeks, `${path}.beforeWeeks`, trainingWeek),
      afterWeeks: array(raw.afterWeeks, `${path}.afterWeeks`, trainingWeek),
    }
  }
  if (kind === 'cancel_workout') {
    return {
      kind,
      before: parseWorkoutPrescription(raw.before, `${path}.before`),
      after: parseWorkoutPrescription(raw.after, `${path}.after`),
    }
  }
  return {
    kind,
    before: raw.before === null ? null : parseWorkoutPrescription(raw.before, `${path}.before`),
    after: parseWorkoutPrescription(raw.after, `${path}.after`),
  }
}

export function parseCoachDecision(value: unknown, path = 'decision'): CoachDecision {
  const raw = object(value, path)
  schemaVersion(raw.schemaVersion, `${path}.schemaVersion`)
  const decision: CoachDecision = {
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: string(raw.id, `${path}.id`),
    outcome: enumeration(raw.outcome, ['KEEP', 'ADJUST', 'REPLAN'], `${path}.outcome`),
    trigger: enumeration(raw.trigger, ['bootstrap', 'post_activity', 'weekly_review', 'autoregulation'], `${path}.trigger`),
    createdAt: timestamp(raw.createdAt, `${path}.createdAt`),
    effectiveDate: isoDate(raw.effectiveDate, `${path}.effectiveDate`),
    planId: string(raw.planId, `${path}.planId`),
    basePlanRevision: raw.basePlanRevision === null ? null : integer(raw.basePlanRevision, `${path}.basePlanRevision`, 1),
    resultPlanRevision: integer(raw.resultPlanRevision, `${path}.resultPlanRevision`, 1),
    reasonCodes: array(raw.reasonCodes, `${path}.reasonCodes`, string),
    summary: string(raw.summary, `${path}.summary`),
    evidence: array(raw.evidence, `${path}.evidence`, evidence),
    changes: array(raw.changes, `${path}.changes`, planChange),
    provenance: provenance(raw.provenance, `${path}.provenance`),
  }
  if (decision.reasonCodes.length === 0) throw new CoachingValidationError(`${path}.reasonCodes`, 'at least one reason is required')
  validateDecisionSemantics(decision, path)
  return decision
}

export function validateDecisionSemantics(decision: CoachDecision, path = 'decision'): void {
  const base = decision.basePlanRevision
  if (decision.outcome === 'KEEP') {
    if (decision.changes.length !== 0) throw new CoachingValidationError(`${path}.changes`, 'KEEP cannot contain changes')
    if (base === null || decision.resultPlanRevision !== base) {
      throw new CoachingValidationError(`${path}.resultPlanRevision`, 'KEEP must preserve the existing revision')
    }
    return
  }
  if (decision.changes.length === 0) throw new CoachingValidationError(`${path}.changes`, `${decision.outcome} requires changes`)
  if (decision.resultPlanRevision !== (base ?? 0) + 1) {
    throw new CoachingValidationError(`${path}.resultPlanRevision`, 'a changed plan must increment the revision once')
  }
  if (decision.outcome === 'ADJUST' && decision.changes.some((change) => change.kind === 'replace_future')) {
    throw new CoachingValidationError(`${path}.changes`, 'ADJUST cannot replace the future plan')
  }
  if (decision.outcome === 'REPLAN' && decision.changes.some((change) => change.kind !== 'replace_future')) {
    throw new CoachingValidationError(`${path}.changes`, 'REPLAN must use replace_future changes')
  }
}

export function parseWorkoutEvaluation(value: unknown, path = 'evaluation'): WorkoutEvaluation {
  const raw = object(value, path)
  schemaVersion(raw.schemaVersion, `${path}.schemaVersion`)
  const comparisonRaw = raw.comparison === undefined ? null : object(raw.comparison, `${path}.comparison`)
  return {
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: string(raw.id, `${path}.id`),
    activityId: string(raw.activityId, `${path}.activityId`),
    activityDate: isoDate(raw.activityDate, `${path}.activityDate`),
    prescriptionId: raw.prescriptionId === null ? null : string(raw.prescriptionId, `${path}.prescriptionId`),
    planId: string(raw.planId, `${path}.planId`),
    planRevision: integer(raw.planRevision, `${path}.planRevision`, 1),
    matchStatus: enumeration(raw.matchStatus, ['matched', 'date_only', 'unmatched'], `${path}.matchStatus`),
    ...(comparisonRaw
      ? {
          comparison: {
            ...(comparisonRaw.plannedDistanceMeters === undefined ? {} : { plannedDistanceMeters: integer(comparisonRaw.plannedDistanceMeters, `${path}.comparison.plannedDistanceMeters`) }),
            ...(comparisonRaw.actualDistanceMeters === undefined ? {} : { actualDistanceMeters: integer(comparisonRaw.actualDistanceMeters, `${path}.comparison.actualDistanceMeters`) }),
            ...(comparisonRaw.plannedDurationSeconds === undefined ? {} : { plannedDurationSeconds: integer(comparisonRaw.plannedDurationSeconds, `${path}.comparison.plannedDurationSeconds`) }),
            ...(comparisonRaw.actualDurationSeconds === undefined ? {} : { actualDurationSeconds: integer(comparisonRaw.actualDurationSeconds, `${path}.comparison.actualDurationSeconds`) }),
            ...(comparisonRaw.plannedPaceSecPerKm === undefined ? {} : { plannedPaceSecPerKm: range(comparisonRaw.plannedPaceSecPerKm, `${path}.comparison.plannedPaceSecPerKm`) }),
            ...(comparisonRaw.actualPaceSecPerKm === undefined ? {} : { actualPaceSecPerKm: number(comparisonRaw.actualPaceSecPerKm, `${path}.comparison.actualPaceSecPerKm`, 1) }),
            ...(comparisonRaw.plannedHrBpm === undefined ? {} : { plannedHrBpm: range(comparisonRaw.plannedHrBpm, `${path}.comparison.plannedHrBpm`) }),
            ...(comparisonRaw.actualAvgHrBpm === undefined ? {} : { actualAvgHrBpm: integer(comparisonRaw.actualAvgHrBpm, `${path}.comparison.actualAvgHrBpm`, 1) }),
          },
        }
      : {}),
    decisionId: string(raw.decisionId, `${path}.decisionId`),
    summary: string(raw.summary, `${path}.summary`),
    createdAt: timestamp(raw.createdAt, `${path}.createdAt`),
    contextHash: string(raw.contextHash, `${path}.contextHash`),
    provenance: provenance(raw.provenance, `${path}.provenance`),
  }
}

export function parseCoachState(value: unknown, path = 'state'): CoachState {
  const raw = object(value, path)
  schemaVersion(raw.schemaVersion, `${path}.schemaVersion`)
  return {
    schemaVersion: COACHING_SCHEMA_VERSION,
    activePlanId: nullableString(raw.activePlanId, `${path}.activePlanId`),
    activePlanRevision: raw.activePlanRevision === null ? null : integer(raw.activePlanRevision, `${path}.activePlanRevision`, 1),
    lastDecisionId: nullableString(raw.lastDecisionId, `${path}.lastDecisionId`),
    lastBootstrapAt: raw.lastBootstrapAt === null ? null : timestamp(raw.lastBootstrapAt, `${path}.lastBootstrapAt`),
    lastPostActivityAt: raw.lastPostActivityAt === null ? null : timestamp(raw.lastPostActivityAt, `${path}.lastPostActivityAt`),
    lastWeeklyReviewAt: raw.lastWeeklyReviewAt === null ? null : timestamp(raw.lastWeeklyReviewAt, `${path}.lastWeeklyReviewAt`),
    ...(raw.macrocycle === undefined || raw.macrocycle === null
      ? {}
      : { macrocycle: macrocycleState(raw.macrocycle, `${path}.macrocycle`) }),
    updatedAt: timestamp(raw.updatedAt, `${path}.updatedAt`),
  }
}

function macrocycleState(value: unknown, path: string): NonNullable<CoachState['macrocycle']> {
  const raw = object(value, path)
  return {
    targetEventId: string(raw.targetEventId, `${path}.targetEventId`),
    startDate: isoDate(raw.startDate, `${path}.startDate`),
  }
}

function trainingPreferences(value: unknown): NonNullable<CoachingPlan['trainingPreferences']> {
  const raw = object(value, 'trainingPreferences')
  const days = array(raw.availableWeekdays, 'availableWeekdays', (v, p) => integer(v, p, 0))
  if (!days.length || days.some(d => d > 6) || new Set(days).size !== days.length) throw new Error('Invalid availableWeekdays')
  const runs = raw.runsPerWeek === undefined ? undefined : integer(raw.runsPerWeek, 'runsPerWeek', 1)
  if (runs !== undefined && runs > days.length) throw new Error('runsPerWeek exceeds available weekdays')
  return { availableWeekdays: days, ...(runs === undefined ? {} : { runsPerWeek: runs }) }
}

function raceCourseContext(value: unknown, path: string): NonNullable<TargetEvent['courseContext']> {
  const raw = object(value, path)
  return {
    pacingNotes: array(raw.pacingNotes, `${path}.pacingNotes`, string),
    ...(raw.paceProSplits === undefined ? {} : { paceProSplits: array(raw.paceProSplits, `${path}.paceProSplits`, (value, path) => {
      const split = object(value, path)
      return { distanceMeters: integer(split.distanceMeters, `${path}.distanceMeters`, 1), targetSeconds: integer(split.targetSeconds, `${path}.targetSeconds`, 1) }
    }) }),
  }
}
