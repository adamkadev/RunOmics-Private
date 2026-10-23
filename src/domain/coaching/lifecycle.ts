import type { CoachDecision, CoachingPlan, TrainingWeek, WorkoutPrescription } from './types'
import { CoachingValidationError, parseCoachingPlan, validateDecisionSemantics } from './validation'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function workouts(plan: CoachingPlan): WorkoutPrescription[] {
  return plan.weeks.flatMap((week) => week.workouts)
}

function findWeekForDate(weeks: TrainingWeek[], date: string): TrainingWeek | null {
  return weeks.find((week) => date >= week.startDate && date <= week.endDate) ?? null
}

function assertCurrentWorkout(
  plan: CoachingPlan,
  expected: WorkoutPrescription,
  path: string,
): WorkoutPrescription {
  const current = workouts(plan).find((workout) => workout.id === expected.id)
  if (!current || !same(current, expected)) {
    throw new CoachingValidationError(path, `workout ${expected.id} no longer matches the current plan`)
  }
  return current
}

function applyWorkoutChanges(plan: CoachingPlan, decision: CoachDecision): TrainingWeek[] {
  const weeks = clone(plan.weeks)
  const changedIds = new Set<string>()

  for (const [index, change] of decision.changes.entries()) {
    const path = `decision.changes[${index}]`
    if (change.kind === 'replace_future') {
      throw new CoachingValidationError(path, 'ADJUST cannot contain replace_future')
    }
    if (changedIds.has(change.after.id)) throw new CoachingValidationError(path, `duplicate change for workout ${change.after.id}`)
    changedIds.add(change.after.id)

    const current = change.before ? assertCurrentWorkout(plan, change.before, `${path}.before`) : null
    if (current && current.date < decision.effectiveDate) {
      throw new CoachingValidationError(path, 'past prescriptions are immutable')
    }
    if (change.after.date < decision.effectiveDate) {
      throw new CoachingValidationError(`${path}.after.date`, 'changed workout must be in the future')
    }
    if (current) {
      if (change.after.id !== current.id) throw new CoachingValidationError(`${path}.after.id`, 'changed workout must retain its id')
      if (change.after.revision !== current.revision + 1) {
        throw new CoachingValidationError(`${path}.after.revision`, 'changed workout must increment its revision once')
      }
    } else if (change.after.revision !== 1) {
      throw new CoachingValidationError(`${path}.after.revision`, 'new workout must start at revision 1')
    }
    if (change.kind === 'cancel_workout' && change.after.status !== 'cancelled') {
      throw new CoachingValidationError(`${path}.after.status`, 'cancel_workout must produce cancelled status')
    }

    for (const week of weeks) week.workouts = week.workouts.filter((workout) => workout.id !== change.after.id)
    const destination = findWeekForDate(weeks, change.after.date)
    if (!destination) throw new CoachingValidationError(`${path}.after.date`, 'changed workout falls outside the plan horizon')
    destination.workouts.push(clone(change.after))
    destination.workouts.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  }
  return weeks
}

function futureSnapshot(plan: CoachingPlan, effectiveDate: string): TrainingWeek[] {
  return plan.weeks
    .map((week) => ({
      ...clone(week),
      workouts: week.workouts.filter((workout) => workout.date >= effectiveDate),
    }))
    .filter((week) => week.endDate >= effectiveDate)
}

function applyReplan(plan: CoachingPlan, decision: CoachDecision): TrainingWeek[] {
  const change = decision.changes[0]
  if (!change || change.kind !== 'replace_future' || decision.changes.length !== 1) {
    throw new CoachingValidationError('decision.changes', 'REPLAN requires exactly one replace_future change')
  }
  if (change.effectiveDate !== decision.effectiveDate) {
    throw new CoachingValidationError('decision.changes[0].effectiveDate', 'must match decision effectiveDate')
  }
  const currentFuture = futureSnapshot(plan, decision.effectiveDate)
  if (!same(change.beforeWeeks, currentFuture)) {
    throw new CoachingValidationError('decision.changes[0].beforeWeeks', 'future snapshot is stale')
  }
  for (const week of change.afterWeeks) {
    for (const workout of week.workouts) {
      if (workout.date < decision.effectiveDate) {
        throw new CoachingValidationError('decision.changes[0].afterWeeks', 'replacement contains a past workout')
      }
    }
  }

  const replacement = clone(change.afterWeeks)
  const history = plan.weeks
    .map((week) => ({ ...clone(week), workouts: week.workouts.filter((workout) => workout.date < decision.effectiveDate) }))
    .filter((week) => week.workouts.length > 0)
  // Merged by id, a replacement carrying a past prescription's id would silently take its place in history.
  const pastIds = new Set(history.flatMap((week) => week.workouts.map((workout) => workout.id)))
  for (const week of replacement) {
    for (const workout of week.workouts) {
      if (pastIds.has(workout.id)) {
        throw new CoachingValidationError('decision.changes[0].afterWeeks', `replacement reuses the id of past prescription ${workout.id}`)
      }
    }
  }
  for (const historicalWeek of history) {
    const destination = replacement.find((week) => week.id === historicalWeek.id)
      ?? findWeekForDate(replacement, historicalWeek.workouts[0]!.date)
    if (!destination) {
      replacement.push(historicalWeek)
      continue
    }
    destination.workouts.push(...historicalWeek.workouts.map((workout) => clone(workout)))
  }
  for (const week of replacement) week.workouts.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  return replacement.sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export function applyCoachDecision(plan: CoachingPlan, decision: CoachDecision): CoachingPlan {
  validateDecisionSemantics(decision)
  if (decision.planId !== plan.id) throw new CoachingValidationError('decision.planId', 'does not match the current plan')
  if (decision.basePlanRevision !== plan.revision) {
    throw new CoachingValidationError('decision.basePlanRevision', `stale plan revision; current is ${plan.revision}`)
  }
  if (decision.outcome === 'KEEP') return clone(plan)

  const next: CoachingPlan = {
    ...clone(plan),
    revision: decision.resultPlanRevision,
    weeks:
      decision.outcome === 'ADJUST'
        ? applyWorkoutChanges(plan, decision)
        : applyReplan(plan, decision),
    provenance: {
      ...decision.provenance,
      decisionId: decision.id,
      parentRevision: plan.revision,
    },
  }
  return parseCoachingPlan(next)
}

export function getFutureSnapshot(plan: CoachingPlan, effectiveDate: string): TrainingWeek[] {
  return clone(futureSnapshot(plan, effectiveDate))
}
