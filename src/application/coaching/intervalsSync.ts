import {
  IntervalsNotFoundError,
  IntervalsRateLimitError,
  type IntervalsCalendarGateway,
  type IntervalsEventRecord,
} from '@/application/ports/IntervalsCalendarGateway'
import type { CoachingPlan, WorkoutEvaluation, WorkoutPrescription } from '@/domain/coaching/types'
import { syncRange, workoutsWithin, type GarminSyncOptions, type GarminSyncWindow, type SyncRange } from './garminSync'
import { isCourseAwareRace, raceEventFor, withoutCourseAwarePaceTarget } from './garminWorkoutMapping'
import { stableHash } from './garminSyncState'
import {
  emptyIntervalsSyncState,
  intervalsContentHash,
  INTERVALS_SYNC_SCHEMA_VERSION,
  type IntervalsSyncEntry,
  type IntervalsSyncState,
} from './intervalsSyncState'
import { IntervalsEncodingError, toIntervalsWorkoutEvent, type IntervalsWorkoutEvent } from './intervalsWorkoutEncoding'

export type IntervalsSyncAction = 'create' | 'update' | 'delete' | 'keep' | 'skip'

export interface IntervalsSyncOperation {
  action: IntervalsSyncAction
  date: string
  title: string
  prescriptionId: string
  event: IntervalsWorkoutEvent | null
  contentHash: string | null
  existing: IntervalsSyncEntry | null
  reason: string | null
}

export interface IntervalsSyncPlan {
  planId: string
  planRevision: number
  today: string
  operations: IntervalsSyncOperation[]
  fingerprint: string
}

const RACE_ON_CALENDAR_REASON = 'Race already on the Garmin calendar'
const COURSE_AWARE_RACE_REASON = 'Course-aware race already on Garmin calendar - use Garmin PacePro'
const COURSE_AWARE_RACE_NOTE = 'Course-aware race - race effort left unpaced for PacePro'

function operationFor(
  workout: WorkoutPrescription,
  plan: CoachingPlan,
  existing: IntervalsSyncEntry | null,
  options: GarminSyncOptions,
): IntervalsSyncOperation {
  const base = { date: workout.date, title: workout.title, prescriptionId: workout.id, existing }
  const courseAware = isCourseAwareRace(plan, workout)
  const skip = (reason: string): IntervalsSyncOperation => ({ ...base, action: 'skip', event: null, contentHash: null, reason })

  if (workout.type === 'race' && !options.syncRaces) return skip(courseAware ? COURSE_AWARE_RACE_REASON : RACE_ON_CALENDAR_REASON)

  const raceEvent = courseAware ? raceEventFor(plan, workout) : null
  const source = raceEvent ? withoutCourseAwarePaceTarget(workout, raceEvent).workout : workout
  let event: IntervalsWorkoutEvent
  try {
    event = toIntervalsWorkoutEvent(source)
  } catch (error) {
    if (error instanceof IntervalsEncodingError) return skip(error.message)
    throw error
  }
  const contentHash = intervalsContentHash(event)
  const note = courseAware ? COURSE_AWARE_RACE_NOTE : null

  if (!existing) return { ...base, action: 'create', event, contentHash, reason: note }
  if (existing.contentHash !== contentHash) {
    const reason = existing.date !== workout.date ? `Prescription moved from ${existing.date}` : 'Prescription changed'
    return { ...base, action: 'update', event, contentHash, reason }
  }
  if (existing.status === 'unverified') {
    return { ...base, action: 'update', event, contentHash, reason: 'intervals.icu did not confirm the last push' }
  }
  return { ...base, action: 'keep', event, contentHash, reason: null }
}

function deletions(state: IntervalsSyncState, syncedIds: Set<string>, range: SyncRange): IntervalsSyncOperation[] {
  return state.entries
    .filter((entry) => !syncedIds.has(entry.prescriptionId) && range.contains(entry.date))
    .map((entry) => ({
      action: 'delete' as const,
      date: entry.date,
      title: entry.prescriptionId,
      prescriptionId: entry.prescriptionId,
      event: null,
      contentHash: null,
      existing: entry,
      reason: 'No longer in the active future plan',
    }))
}

const ACTION_ORDER: Record<IntervalsSyncAction, number> = { delete: 0, update: 1, create: 2, keep: 3, skip: 4 }

function finish(planId: string, planRevision: number, today: string, operations: IntervalsSyncOperation[]): IntervalsSyncPlan {
  const sorted = [...operations].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      ACTION_ORDER[left.action] - ACTION_ORDER[right.action] ||
      left.prescriptionId.localeCompare(right.prescriptionId),
  )
  const fingerprint = stableHash({
    plan: `intervals:${planId}:${planRevision}`,
    operations: sorted.map((operation) => [operation.action, operation.date, operation.prescriptionId, operation.contentHash ?? '-'].join('|')),
  })
  return { planId, planRevision, today, operations: sorted, fingerprint }
}

export function buildIntervalsSyncPlan(
  plan: CoachingPlan,
  evaluations: WorkoutEvaluation[],
  state: IntervalsSyncState | null,
  window: GarminSyncWindow,
  options: GarminSyncOptions = {},
): IntervalsSyncPlan {
  const current = state ?? emptyIntervalsSyncState()
  const recorded = new Map(current.entries.map((entry) => [entry.prescriptionId, entry]))
  // Sessions a new plan kept from the old one carry the old plan's id as a prefix (bootstrap --start).
  const known = current.planId === null || current.planId === plan.id
    ? recorded
    : new Map([...recorded].filter(([prescriptionId]) => prescriptionId.startsWith(`${current.planId}:`)))

  const range = syncRange(window)
  const workouts = workoutsWithin(plan, evaluations, range)
  const operations = workouts.map((workout) => operationFor(workout, plan, known.get(workout.id) ?? null, options))
  const syncedIds = new Set(workouts.map((workout) => workout.id))
  return finish(plan.id, plan.revision, window.today, [...operations, ...deletions(current, syncedIds, range)])
}

/** Deletes every RunOmics event from `today` on, for a switch back to the Connect route. */
export function intervalsRetirementPlan(state: IntervalsSyncState, today: string): IntervalsSyncPlan {
  return finish(state.planId ?? 'retired', 0, today, deletions(state, new Set(), syncRange({ today })))
}

export function pendingIntervalsEntries(state: IntervalsSyncState, today: string): IntervalsSyncEntry[] {
  return state.entries.filter((entry) => entry.date >= today)
}

export type IntervalsSyncOutcome = 'applied' | 'skipped' | 'failed'

export interface IntervalsSyncResult {
  operation: IntervalsSyncOperation
  outcome: IntervalsSyncOutcome
  eventId: string | null
  verified: boolean
  error: string | null
}

export interface IntervalsSyncReport {
  results: IntervalsSyncResult[]
  state: IntervalsSyncState
  rateLimited: boolean
}

export interface IntervalsApplyOptions {
  athleteId: string
  now: () => string
  /** Called after every mutation: a run that skips it forgets what intervals.icu accepted and creates it again. */
  persist: (state: IntervalsSyncState) => void
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The recorded id alone could name an event someone reused or that another app wrote; the external id must match too. */
async function ownedEvent(gateway: IntervalsCalendarGateway, entry: IntervalsSyncEntry): Promise<IntervalsEventRecord | null> {
  const event = await gateway.getEvent(entry.eventId)
  if (event && event.externalId !== entry.externalId) {
    throw new Error(`intervals.icu event ${entry.eventId} was not created by RunOmics (external id ${event.externalId ?? 'none'}); left untouched`)
  }
  return event
}

async function alreadyGoneIsDone(removal: Promise<void>): Promise<void> {
  try {
    await removal
  } catch (error) {
    if (!(error instanceof IntervalsNotFoundError)) throw error
  }
}

export async function applyIntervalsSyncPlan(
  syncPlan: IntervalsSyncPlan,
  state: IntervalsSyncState | null,
  gateway: IntervalsCalendarGateway,
  options: IntervalsApplyOptions,
): Promise<IntervalsSyncReport> {
  const previous = state ?? emptyIntervalsSyncState(options.athleteId)
  if (previous.athleteId !== null && previous.athleteId !== options.athleteId) {
    throw new Error(
      `The intervals.icu sync state belongs to athlete ${previous.athleteId}, not ${options.athleteId}: ` +
        'its events live on that account, so nothing was sent',
    )
  }
  let entries = [...previous.entries]
  const results: IntervalsSyncResult[] = []
  let rateLimited = false

  const snapshot = (): IntervalsSyncState => ({
    schemaVersion: INTERVALS_SYNC_SCHEMA_VERSION,
    athleteId: options.athleteId,
    planId: syncPlan.planId,
    updatedAt: options.now(),
    entries,
  })
  const record = (entry: IntervalsSyncEntry) => {
    entries = [...entries.filter((existing) => existing.prescriptionId !== entry.prescriptionId), entry]
      .sort((left, right) => left.date.localeCompare(right.date))
    options.persist(snapshot())
  }
  const forget = (prescriptionId: string) => {
    entries = entries.filter((entry) => entry.prescriptionId !== prescriptionId)
    options.persist(snapshot())
  }

  for (const operation of syncPlan.operations) {
    if (rateLimited) break
    if (operation.action === 'keep' || operation.action === 'skip') {
      results.push({ operation, outcome: 'skipped', eventId: operation.existing?.eventId ?? null, verified: false, error: null })
      continue
    }

    try {
      if (operation.action === 'delete') {
        const entry = operation.existing
        if (!entry) throw new Error('Delete without a sync entry')
        if (await ownedEvent(gateway, entry)) await alreadyGoneIsDone(gateway.deleteEvent(entry.eventId))
        forget(entry.prescriptionId)
        results.push({ operation, outcome: 'applied', eventId: entry.eventId, verified: false, error: null })
        continue
      }

      const event = operation.event
      if (!event || !operation.contentHash) throw new Error(`Operation ${operation.action} on ${operation.date} carries no event`)

      let saved: IntervalsEventRecord | null = null
      if (operation.action === 'update' && operation.existing && (await ownedEvent(gateway, operation.existing))) {
        try {
          saved = await gateway.updateEvent(operation.existing.eventId, event)
        } catch (error) {
          if (!(error instanceof IntervalsNotFoundError)) throw error
        }
      }
      saved ??= await gateway.createEvent(event)

      record({
        prescriptionId: operation.prescriptionId,
        date: operation.date,
        contentHash: operation.contentHash,
        eventId: saved.id,
        externalId: event.external_id,
        status: 'synced',
        lastSyncedAt: options.now(),
      })
      results.push({ operation, outcome: 'applied', eventId: saved.id, verified: false, error: null })
    } catch (error) {
      if (error instanceof IntervalsRateLimitError) rateLimited = true
      results.push({ operation, outcome: 'failed', eventId: operation.existing?.eventId ?? null, verified: false, error: message(error) })
    }
  }

  return { results, rateLimited, state: snapshot() }
}

export async function verifyIntervalsSync(report: IntervalsSyncReport, gateway: IntervalsCalendarGateway): Promise<IntervalsSyncReport> {
  const applied = report.results.filter((result) => result.outcome === 'applied' && result.eventId && result.operation.action !== 'delete')
  if (!applied.length) return report

  const dates = applied.map((result) => result.operation.date).sort()
  const listed = await gateway.listWorkoutEvents(dates[0]!, dates.at(-1)!)
  const unconfirmed = new Set<string>()

  const results = report.results.map((result) => {
    if (!applied.includes(result)) return result
    const externalId = result.operation.event?.external_id
    const event = listed.find((candidate) => candidate.id === result.eventId)
    const copies = listed.filter((candidate) => candidate.externalId === externalId && candidate.id !== result.eventId)
    if (event && event.externalId === externalId && event.date === result.operation.date && !copies.length) return { ...result, verified: true }
    unconfirmed.add(result.operation.prescriptionId)
    const error = !event
      ? 'Event not found on intervals.icu after the push'
      : event.date !== result.operation.date
        ? `Event is on ${event.date}, not ${result.operation.date}`
        : copies.length
          ? `Duplicate RunOmics event(s) ${copies.map((copy) => copy.id).join(', ')} on intervals.icu; delete them there by hand`
          : 'Event carries another external id'
    return { ...result, outcome: 'failed' as const, error }
  })

  // Left "synced", a failed check would read as done and the next run would keep it instead of pushing it again.
  const entries = report.state.entries.map((entry) => (unconfirmed.has(entry.prescriptionId) ? { ...entry, status: 'unverified' as const } : entry))
  return { ...report, results, state: { ...report.state, entries } }
}

const LABEL: Record<IntervalsSyncAction, string> = { create: 'CREATE', update: 'UPDATE', delete: 'DELETE', keep: 'KEEP', skip: 'SKIP' }

export function intervalsMutationCount(syncPlan: IntervalsSyncPlan): number {
  return syncPlan.operations.filter((operation) => operation.action !== 'keep' && operation.action !== 'skip').length
}

export function formatIntervalsSyncPreview(syncPlan: IntervalsSyncPlan): string {
  const lines = ['intervals.icu sync preview', '']
  for (const operation of syncPlan.operations) {
    lines.push(`${LABEL[operation.action].padEnd(7)} ${operation.date}  ${operation.title}`)
    if (operation.reason) lines.push(`        ${operation.reason}`)
  }
  if (!syncPlan.operations.length) lines.push('Nothing to synchronize.')
  const count = (action: IntervalsSyncAction) => syncPlan.operations.filter((operation) => operation.action === action).length
  lines.push(
    '',
    'Summary:',
    `Create: ${count('create')}`,
    `Update: ${count('update')}`,
    `Delete: ${count('delete')}`,
    `Keep: ${count('keep')}`,
    `Skip: ${count('skip')}`,
  )
  return lines.join('\n')
}

export function formatIntervalsSyncResults(report: IntervalsSyncReport): string {
  const marks: Record<IntervalsSyncOutcome, string> = { applied: '✓', skipped: '-', failed: '✗' }
  const lines = report.results.map((result) => {
    const detail = result.error ?? result.operation.reason
    return `${LABEL[result.operation.action].padEnd(6)} ${marks[result.outcome]} ${result.operation.date} ${result.operation.title}${detail ? ` (${detail})` : ''}`
  })
  const synchronized = report.results.filter((result) => result.outcome === 'applied').length
  const failures = report.results.filter((result) => result.outcome === 'failed').length
  lines.push('', `${synchronized} intervals.icu workout(s) synchronized.`, `${failures} failure(s).`)
  if (report.rateLimited) lines.push('Stopped early: intervals.icu rate limited the run. Re-run later to finish.')
  return lines.join('\n')
}
