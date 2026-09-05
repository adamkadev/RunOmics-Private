import type { CoachingPlan, WorkoutEvaluation, WorkoutPrescription } from '@/domain/coaching/types'
import { selectGarminExportWorkouts, type GarminExportWindow } from './garminExport'
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

/**
 * Turns the active plan plus the athlete's Garmin sync state into an explicit,
 * ordered list of Garmin mutations. Pure: it performs no I/O and reaches
 * Garmin only through the operations it returns, so a preview and the apply
 * that follows compute the same plan from the same inputs.
 */

/**
 * `keep` and `skip` both leave Garmin untouched, but for opposite reasons:
 * `keep` is a workout already synchronised and unchanged, `skip` is one
 * deliberately excluded from structured-workout sync. Reporting both as "skip"
 * hid that difference.
 */
export type GarminSyncAction = 'create' | 'schedule' | 'replace' | 'delete' | 'keep' | 'skip'

export interface GarminSyncOperation {
  action: GarminSyncAction
  date: string
  title: string
  prescriptionId: string | null
  /** The payload to send, for every action that writes a workout. */
  payload: GarminWorkoutPayload | null
  contentHash: string | null
  /** Garmin ids already known for this prescription; the basis for every non-create action. */
  existing: GarminSyncEntry | null
  /** Shown in the preview for `skip`, and in the log for `replace`. */
  reason: string | null
}

export interface GarminSyncPlan {
  planId: string
  planRevision: number
  today: string
  operations: GarminSyncOperation[]
  /** Identifies these exact operations, so `--apply` can refuse a stale plan. */
  fingerprint: string
}

/**
 * Races are not pushed as structured workouts: the race is already on the
 * Garmin calendar as an event - RunOmics reads those events from Garmin in the
 * first place (see scripts/sync_upcoming_races.py) - so a workout on the same
 * date would only duplicate it. A course-aware race has a second reason: the
 * athlete's own PacePro strategy paces it.
 */
export const RACE_ON_CALENDAR_REASON = 'Race already on the Garmin calendar'
export const COURSE_AWARE_RACE_REASON = 'Course-aware race already on Garmin calendar - use Garmin PacePro'
/** Shown on a course-aware race synced through `syncRaces`, so the preview says what reaches the watch. */
export const COURSE_AWARE_RACE_NOTE = 'Course-aware race - race effort left unpaced for PacePro'

export interface GarminSyncOptions {
  /** Push race prescriptions as structured workouts too. Off by default. */
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

  // The race effort is stripped of any pace target before it is mapped, so the
  // hash below describes exactly what Garmin will hold.
  const event = courseAware ? raceEventFor(plan, workout) : null
  const source = event ? withoutCourseAwarePaceTarget(workout, event).workout : workout
  const note = courseAware ? COURSE_AWARE_RACE_NOTE : null

  const payload = toGarminWorkoutPayload(source)
  const contentHash = garminContentHash(payload, workout.date)

  if (!existing) return { ...base, action: 'create', payload, contentHash, reason: note }

  // A create that landed but whose scheduling failed: the workout is already on
  // Garmin, so this run finishes the job rather than creating a second copy.
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
 * Entries whose prescription has left the future plan. Past entries are never
 * candidates: Garmin history stays exactly as the athlete lived it.
 */
function deletions(
  state: GarminSyncState,
  syncedIds: Set<string>,
  today: string,
): GarminSyncOperation[] {
  return state.entries
    .filter((entry) => !syncedIds.has(entry.prescriptionId))
    .filter((entry) => entry.date >= today)
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

/** Order is the preview's order and the apply's order: by date, then by action. */
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
  window: GarminExportWindow,
  options: GarminSyncOptions = {},
): GarminSyncPlan {
  const current = state ?? emptyGarminSyncState()
  // A sync state written for a different plan describes workouts this plan no
  // longer owns; its entries stay eligible for cleanup but never for reuse.
  const known = current.planId === null || current.planId === plan.id ? entriesByPrescription(current) : new Map()

  const workouts = selectGarminExportWorkouts(plan, evaluations, window)
  const operations = workouts.map((workout) => operationFor(workout, plan, known.get(workout.id) ?? null, options))
  const syncedIds = new Set(workouts.map((workout) => workout.id))

  const all = [...operations, ...deletions(current, syncedIds, window.today)].sort(
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
    // A retried schedule completes a create; it is not a separate kind of change.
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

/** Create, update and delete are the only actions that touch Garmin. */
export function hasGarminMutations(counts: GarminSyncCounts): boolean {
  return counts.create + counts.update + counts.delete > 0
}

/** Every mutation the apply would make, in the order it would make them. */
export function formatGarminSyncPreview(syncPlan: GarminSyncPlan): string {
  const counts = countOperations(syncPlan.operations)
  const lines = ['Garmin sync preview', '']

  for (const operation of syncPlan.operations) {
    const label = PREVIEW_LABEL[operation.action].padEnd(7)
    lines.push(`${label} ${operation.date}  ${operation.title}`)
    // A reason gets its own indented line, so it never reads as part of the title.
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
