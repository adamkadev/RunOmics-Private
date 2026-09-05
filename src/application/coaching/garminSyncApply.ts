import { GarminRateLimitError, type GarminWorkoutGateway } from '@/application/ports/GarminWorkoutGateway'
import type { GarminSyncOperation, GarminSyncPlan } from './garminSync'
import { emptyGarminSyncState, GARMIN_SYNC_SCHEMA_VERSION, type GarminSyncEntry, type GarminSyncState } from './garminSyncState'

/**
 * Executes a computed sync plan against Garmin, one operation at a time, and
 * hands back the sync state to persist.
 *
 * The state is returned after every operation - including a failed one - so a
 * create whose scheduling then failed is still recorded. That record is what
 * stops the next run from creating a second copy of the same workout.
 */

export type GarminSyncOutcome = 'applied' | 'skipped' | 'failed'

export interface GarminSyncResult {
  operation: GarminSyncOperation
  outcome: GarminSyncOutcome
  garminWorkoutId: string | null
  garminWorkoutScheduleId: string | null
  /** Set when the post-apply read-back confirmed the workout and its date. */
  verified: boolean
  error: string | null
}

export interface GarminSyncReport {
  results: GarminSyncResult[]
  state: GarminSyncState
  /** True when a Garmin 429 stopped the run before every operation was attempted. */
  rateLimited: boolean
}

export interface GarminApplyOptions {
  now: () => string
  /** Awaited between Garmin writes, so a run never hammers the private API. */
  pause?: (ms: number) => Promise<void>
  pauseMs?: number
}

function upsert(entries: GarminSyncEntry[], entry: GarminSyncEntry): GarminSyncEntry[] {
  const rest = entries.filter((existing) => existing.prescriptionId !== entry.prescriptionId)
  return [...rest, entry].sort((left, right) => left.date.localeCompare(right.date))
}

function remove(entries: GarminSyncEntry[], prescriptionId: string): GarminSyncEntry[] {
  return entries.filter((entry) => entry.prescriptionId !== prescriptionId)
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Create-then-schedule, the pair validated by scripts/garmin/test_workout_write.py.
 * A failure between the two leaves `workout_created` behind on purpose.
 */
async function createAndSchedule(
  gateway: GarminWorkoutGateway,
  operation: GarminSyncOperation,
  now: string,
  knownWorkoutId: string | null,
): Promise<{ entry: GarminSyncEntry; result: GarminSyncResult }> {
  const payload = operation.payload
  if (!payload || !operation.prescriptionId || !operation.contentHash) {
    throw new Error(`Operation ${operation.action} on ${operation.date} carries no payload`)
  }

  const workoutId = knownWorkoutId ?? (await gateway.createWorkout(payload)).workoutId
  const partial: GarminSyncEntry = {
    prescriptionId: operation.prescriptionId,
    date: operation.date,
    contentHash: operation.contentHash,
    garminWorkoutId: workoutId,
    garminWorkoutScheduleId: null,
    status: 'workout_created',
    lastSyncedAt: now,
  }

  try {
    const { workoutScheduleId } = await gateway.scheduleWorkout(workoutId, operation.date)
    return {
      entry: { ...partial, garminWorkoutScheduleId: workoutScheduleId, status: 'scheduled' },
      result: {
        operation,
        outcome: 'applied',
        garminWorkoutId: workoutId,
        garminWorkoutScheduleId: workoutScheduleId,
        verified: false,
        error: null,
      },
    }
  } catch (error) {
    if (error instanceof GarminRateLimitError) throw error
    // The workout exists on Garmin; recording it is what makes the retry safe.
    return {
      entry: partial,
      result: {
        operation,
        outcome: 'failed',
        garminWorkoutId: workoutId,
        garminWorkoutScheduleId: null,
        verified: false,
        error: `Workout created but scheduling failed: ${message(error)}`,
      },
    }
  }
}

/** Removes only what this sync state proves RunOmics created. */
async function removeManaged(gateway: GarminWorkoutGateway, entry: GarminSyncEntry): Promise<void> {
  if (entry.garminWorkoutScheduleId) await gateway.unscheduleWorkout(entry.garminWorkoutScheduleId)
  await gateway.deleteWorkout(entry.garminWorkoutId)
}

export async function applyGarminSyncPlan(
  syncPlan: GarminSyncPlan,
  state: GarminSyncState | null,
  gateway: GarminWorkoutGateway,
  options: GarminApplyOptions,
): Promise<GarminSyncReport> {
  const previous = state ?? emptyGarminSyncState()
  let entries = [...previous.entries]
  const results: GarminSyncResult[] = []
  let rateLimited = false

  for (const operation of syncPlan.operations) {
    if (rateLimited) break

    if (operation.action === 'keep' || operation.action === 'skip') {
      const entry = operation.existing
      results.push({
        operation,
        outcome: 'skipped',
        garminWorkoutId: entry?.garminWorkoutId ?? null,
        garminWorkoutScheduleId: entry?.garminWorkoutScheduleId ?? null,
        verified: false,
        error: null,
      })
      continue
    }

    try {
      if (options.pause && results.some((result) => result.outcome === 'applied')) {
        await options.pause(options.pauseMs ?? 1_000)
      }

      if (operation.action === 'delete') {
        const entry = operation.existing
        if (!entry) throw new Error('Delete without a mapping entry')
        await removeManaged(gateway, entry)
        entries = remove(entries, entry.prescriptionId)
        results.push({
          operation,
          outcome: 'applied',
          garminWorkoutId: entry.garminWorkoutId,
          garminWorkoutScheduleId: entry.garminWorkoutScheduleId,
          verified: false,
          error: null,
        })
        continue
      }

      // A changed prescription is replaced rather than edited in place: the
      // create/schedule pair is the validated write path, and removing the old
      // one first guarantees the date never ends up holding both versions.
      if (operation.action === 'replace' && operation.existing) {
        await removeManaged(gateway, operation.existing)
        entries = remove(entries, operation.existing.prescriptionId)
      }

      const reuseWorkoutId = operation.action === 'schedule' ? (operation.existing?.garminWorkoutId ?? null) : null
      const { entry, result } = await createAndSchedule(gateway, operation, options.now(), reuseWorkoutId)
      entries = upsert(entries, entry)
      results.push(result)
    } catch (error) {
      if (error instanceof GarminRateLimitError) rateLimited = true
      results.push({
        operation,
        outcome: 'failed',
        garminWorkoutId: operation.existing?.garminWorkoutId ?? null,
        garminWorkoutScheduleId: operation.existing?.garminWorkoutScheduleId ?? null,
        verified: false,
        error: message(error),
      })
    }
  }

  return {
    results,
    rateLimited,
    state: {
      schemaVersion: GARMIN_SYNC_SCHEMA_VERSION,
      planId: syncPlan.planId,
      updatedAt: options.now(),
      entries,
    },
  }
}

/**
 * Reads Garmin back after the writes: every workout this run claims to have
 * created must exist, and must sit on the date it was scheduled for.
 */
export async function verifyGarminSync(
  report: GarminSyncReport,
  gateway: GarminWorkoutGateway,
): Promise<GarminSyncReport> {
  const applied = report.results.filter((result) => result.outcome === 'applied' && result.garminWorkoutId && result.operation.action !== 'delete')
  const months = new Set(applied.map((result) => result.operation.date.slice(0, 7)))
  const scheduled = new Map<string, string>()

  for (const month of months) {
    const year = Number(month.slice(0, 4))
    const monthNumber = Number(month.slice(5, 7))
    for (const item of await gateway.getScheduledWorkouts(year, monthNumber)) {
      scheduled.set(item.workoutId, item.date)
    }
  }

  const results = await Promise.all(
    report.results.map(async (result) => {
      if (!applied.includes(result) || !result.garminWorkoutId) return result
      const workout = await gateway.getWorkout(result.garminWorkoutId)
      const onDate = scheduled.get(result.garminWorkoutId) === result.operation.date
      if (workout && onDate) return { ...result, verified: true }
      return {
        ...result,
        outcome: 'failed' as const,
        error: workout ? `Not scheduled on ${result.operation.date}` : 'Workout not found on Garmin after create',
      }
    }),
  )

  return { ...report, results }
}

/** `CREATE ✓ Sep 08 Aerobic Easy Run` - one line per operation, failures included. */
export function formatGarminSyncResults(report: GarminSyncReport): string {
  const labels: Record<GarminSyncOperation['action'], string> = {
    create: 'CREATE',
    schedule: 'CREATE',
    replace: 'UPDATE',
    delete: 'DELETE',
    keep: 'KEEP  ',
    skip: 'SKIP  ',
  }
  const marks: Record<GarminSyncOutcome, string> = { applied: '✓', skipped: '-', failed: '✗' }

  const lines = report.results.map((result) => {
    const label = labels[result.operation.action]
    const detail = result.error ?? result.operation.reason
    return `${label} ${marks[result.outcome]} ${result.operation.date} ${result.operation.title}${detail ? ` (${detail})` : ''}`
  })

  const synchronized = report.results.filter((result) => result.outcome === 'applied').length
  const failures = report.results.filter((result) => result.outcome === 'failed').length
  lines.push('', `${synchronized} Garmin workout(s) synchronized.`, `${failures} failure(s).`)
  if (report.rateLimited) lines.push('Stopped early: Garmin rate limited the run. Re-run later to finish.')
  return lines.join('\n')
}
