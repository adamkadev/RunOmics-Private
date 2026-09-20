import type { CoachingPlan, WorkoutEvaluation, WorkoutPrescription } from '@/domain/coaching/types'
import {
  isCourseAwareRace,
  raceEventFor,
  toGarminWorkoutPayload,
  withoutCourseAwarePaceTarget,
  type GarminWorkoutPayload,
} from './garminWorkoutMapping'
import {
  emptyGarminSyncState,
  garminContentHash,
  stableHash,
  type GarminSyncEntry,
  type GarminSyncState,
} from './garminSyncState'

export interface GarminSyncWindow {
  today: string
  from?: string
  to?: string
}

function completedPrescriptionIds(evaluations: WorkoutEvaluation[]): Set<string> {
  return new Set(
    evaluations
      .filter((evaluation) => evaluation.matchStatus === 'matched' && evaluation.prescriptionId)
      .map((evaluation) => evaluation.prescriptionId as string),
  )
}

/**
 * The dates this run is allowed to touch.
 *
 * `--from` never reaches back before today: the past is already run, and
 * rewriting it on someone's watch is not what a bound is for.
 */
function syncRange(window: GarminSyncWindow): { from: string; to?: string } {
  const from = window.from && window.from > window.today ? window.from : window.today
  return window.to === undefined ? { from } : { from, to: window.to }
}

function withinRange(date: string, range: { from: string; to?: string }): boolean {
  return date >= range.from && (range.to === undefined || date <= range.to)
}

export function selectSyncableWorkouts(
  plan: CoachingPlan,
  evaluations: WorkoutEvaluation[],
  window: GarminSyncWindow,
): WorkoutPrescription[] {
  const completed = completedPrescriptionIds(evaluations)
  const range = syncRange(window)
  return plan.weeks
    .flatMap((week) => week.workouts)
    .filter((workout) => workout.status === 'prescribed' || workout.status === 'adjusted')
    .filter((workout) => !completed.has(workout.id))
    .filter((workout) => withinRange(workout.date, range))
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
}

export type GarminSyncAction = 'create' | 'schedule' | 'replace' | 'delete' | 'keep' | 'skip'

export interface GarminSyncOperation {
  action: GarminSyncAction
  date: string
  title: string
  prescriptionId: string | null
  payload: GarminWorkoutPayload | null
  contentHash: string | null
  existing: GarminSyncEntry | null
  reason: string | null
}

export interface GarminSyncPlan {
  planId: string
  planRevision: number
  today: string
  operations: GarminSyncOperation[]
  fingerprint: string
}

export const RACE_ON_CALENDAR_REASON = 'Race already on the Garmin calendar'
export const COURSE_AWARE_RACE_REASON = 'Course-aware race already on Garmin calendar - use Garmin PacePro'
export const COURSE_AWARE_RACE_NOTE = 'Course-aware race - race effort left unpaced for PacePro'

export interface GarminSyncOptions {
  syncRaces?: boolean
}

function entriesByPrescription(state: GarminSyncState): Map<string, GarminSyncEntry> {
  return new Map(state.entries.map((entry) => [entry.prescriptionId, entry]))
}

function operationFor(
  workout: WorkoutPrescription,
  plan: CoachingPlan,
  existing: GarminSyncEntry | null,
  options: GarminSyncOptions,
): GarminSyncOperation {
  const base = { date: workout.date, title: workout.title, prescriptionId: workout.id, existing }
  const courseAware = isCourseAwareRace(plan, workout)

  if (workout.type === 'race' && !options.syncRaces) {
    const reason = courseAware ? COURSE_AWARE_RACE_REASON : RACE_ON_CALENDAR_REASON
    return { ...base, action: 'skip', payload: null, contentHash: null, reason }
  }

  const event = courseAware ? raceEventFor(plan, workout) : null
  const source = event ? withoutCourseAwarePaceTarget(workout, event).workout : workout
  const note = courseAware ? COURSE_AWARE_RACE_NOTE : null

  const payload = toGarminWorkoutPayload(source)
  const contentHash = garminContentHash(payload, workout.date)

  if (!existing) return { ...base, action: 'create', payload, contentHash, reason: note }

  if (existing.status === 'workout_created' || !existing.garminWorkoutScheduleId) {
    return { ...base, action: 'schedule', payload, contentHash, reason: 'Retrying a schedule that failed earlier' }
  }

  if (existing.contentHash !== contentHash) {
    const moved = existing.date !== workout.date
    return {
      ...base,
      action: 'replace',
      payload,
      contentHash,
      reason: moved ? `Prescription moved from ${existing.date}` : 'Prescription changed',
    }
  }

  return { ...base, action: 'keep', payload, contentHash, reason: null }
}

/**
 * A deletion is "this prescription is gone from the plan" - so it may only ever
 * be concluded about dates this run actually looked at.
 *
 * `syncedIds` holds the prescriptions inside the window, so without the same
 * range applied here every already-synced workout OUTSIDE it looked like a
 * prescription that had disappeared. `--to 2026-09-12`, read by anyone as
 * "only push up to the 12th", unscheduled and deleted the entire rest of the
 * plan from the athlete's Garmin calendar.
 */
function deletions(
  state: GarminSyncState,
  syncedIds: Set<string>,
  range: { from: string; to?: string },
): GarminSyncOperation[] {
  return state.entries
    .filter((entry) => !syncedIds.has(entry.prescriptionId))
    .filter((entry) => withinRange(entry.date, range))
    .map((entry) => ({
      action: 'delete' as const,
      date: entry.date,
      title: entry.prescriptionId,
      prescriptionId: entry.prescriptionId,
      payload: null,
      contentHash: null,
      existing: entry,
      reason: 'No longer in the active future plan',
    }))
}

const ACTION_ORDER: Record<GarminSyncAction, number> = { delete: 0, replace: 1, create: 2, schedule: 3, keep: 4, skip: 5 }

function fingerprint(operations: GarminSyncOperation[], planId: string, revision: number): string {
  return stableHash({
    plan: `${planId}:${revision}`,
    operations: operations.map((operation) =>
      [operation.action, operation.date, operation.prescriptionId, operation.contentHash ?? '-'].join('|'),
    ),
  })
}

export function buildGarminSyncPlan(
  plan: CoachingPlan,
  evaluations: WorkoutEvaluation[],
  state: GarminSyncState | null,
  window: GarminSyncWindow,
  options: GarminSyncOptions = {},
): GarminSyncPlan {
  const current = state ?? emptyGarminSyncState()
  const known = current.planId === null || current.planId === plan.id ? entriesByPrescription(current) : new Map()

  const workouts = selectSyncableWorkouts(plan, evaluations, window)
  const operations = workouts.map((workout) => operationFor(workout, plan, known.get(workout.id) ?? null, options))
  const syncedIds = new Set(workouts.map((workout) => workout.id))

  const all = [...operations, ...deletions(current, syncedIds, syncRange(window))].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      ACTION_ORDER[left.action] - ACTION_ORDER[right.action] ||
      (left.prescriptionId ?? '').localeCompare(right.prescriptionId ?? ''),
  )

  return {
    planId: plan.id,
    planRevision: plan.revision,
    today: window.today,
    operations: all,
    fingerprint: fingerprint(all, plan.id, plan.revision),
  }
}

export interface GarminSyncCounts {
  create: number
  update: number
  delete: number
  keep: number
  skip: number
}

export function countOperations(operations: GarminSyncOperation[]): GarminSyncCounts {
  return {
    create: operations.filter((operation) => operation.action === 'create' || operation.action === 'schedule').length,
    update: operations.filter((operation) => operation.action === 'replace').length,
    delete: operations.filter((operation) => operation.action === 'delete').length,
    keep: operations.filter((operation) => operation.action === 'keep').length,
    skip: operations.filter((operation) => operation.action === 'skip').length,
  }
}

const PREVIEW_LABEL: Record<GarminSyncAction, string> = {
  create: 'CREATE',
  schedule: 'CREATE',
  replace: 'UPDATE',
  delete: 'DELETE',
  keep: 'KEEP',
  skip: 'SKIP',
}

export function hasGarminMutations(counts: GarminSyncCounts): boolean {
  return counts.create + counts.update + counts.delete > 0
}

export function formatGarminSyncPreview(syncPlan: GarminSyncPlan): string {
  const counts = countOperations(syncPlan.operations)
  const lines = ['Garmin sync preview', '']

  for (const operation of syncPlan.operations) {
    const label = PREVIEW_LABEL[operation.action].padEnd(7)
    lines.push(`${label} ${operation.date}  ${operation.title}`)
    if (operation.reason) lines.push(`        ${operation.reason}`)
  }
  if (!syncPlan.operations.length) lines.push('Nothing to synchronize.')

  lines.push(
    '',
    'Summary:',
    `Create: ${counts.create}`,
    `Update: ${counts.update}`,
    `Delete: ${counts.delete}`,
    `Keep: ${counts.keep}`,
    `Skip: ${counts.skip}`,
  )
  return lines.join('\n')
}
