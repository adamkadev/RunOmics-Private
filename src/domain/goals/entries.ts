import { RACE_DISTANCES, RACE_DISTANCE_KM, type RaceDistanceKey } from '@/domain/race/distances'
import type { GoalTarget, GoalYear, RacePriority, UpcomingRace } from './types'

export const RACE_PRIORITIES: readonly RacePriority[] = ['A', 'B', 'C']

/** Mirrored by firestore.rules, which can only check coarser bounds. */
export const ENTRY_LIMITS = {
  nameMax: 80,
  locationMax: 80,
  garminKeyMax: 120,
  minKm: 1,
  maxKm: 250,
  // Faster than any world record, slower than a brisk walk.
  minPaceSecPerKm: 150,
  maxPaceSecPerKm: 1200,
  maxAnnualKm: 15_000,
  yearsAhead: 5,
} as const

/** As scripts/sync_upcoming_races.py labels Garmin's distances, so an app race reads like a synced one. */
const STANDARD_DISTANCES: readonly [number, string][] = [
  [1, '1K'],
  [5, '5K'],
  [10, '10K'],
  [21.0975, 'Half-Marathon'],
  [42.195, 'Marathon'],
]
const STANDARD_TOLERANCE = 0.03

const GOAL_DISTANCE_LABEL: Record<RaceDistanceKey, string> = {
  '5k': '5K',
  '10k': '10K',
  half: 'Half-Marathon',
  marathon: 'Marathon',
}

export interface RaceFields {
  name: string
  date: string
  distanceKm: number
  priority: RacePriority
  /** Absent: just finish. */
  targetSeconds?: number
  location?: string
}

/** A race added in the app, or under `garminKey` the edit or removal of one synced from Garmin. */
export type RaceEntry =
  | { id: string; garminKey: string; removed: true }
  | ({ id: string; garminKey?: string } & RaceFields)

/** Null: run the distance, no time. */
export type GoalTargets = Partial<Record<RaceDistanceKey, number | null>>

/** Replaces the year in goals.json whole, so a removal hides one written there. */
export type GoalEntry =
  | { year: number; removed: true }
  | { year: number; annualDistanceKm?: number; targets: GoalTargets }

export function raceDistanceLabel(km: number): string {
  for (const [standard, label] of STANDARD_DISTANCES) {
    if (Math.abs(km - standard) / standard <= STANDARD_TOLERANCE) return label
  }
  return `${Number(km.toFixed(2))} km`
}

/** The same identity the coach gives a race, so an edit keeps the plan's target event. */
export function raceKey(race: Pick<UpcomingRace, 'garminEventUuid' | 'garminEventId' | 'entryId' | 'date' | 'name'>): string {
  if (race.garminEventUuid) return race.garminEventUuid
  if (race.garminEventId !== undefined) return String(race.garminEventId)
  return race.entryId ?? `${race.date}:${race.name}`
}

/** Firestore ids take no slash, and one synced race keeps one overlay document. */
export function garminEntryId(garminKey: string): string {
  return `garmin-${garminKey.replace(/[^A-Za-z0-9_-]/g, '_')}`
}

export function priorityOf(race: UpcomingRace): RacePriority {
  return race.priority ?? (race.isPrimaryEvent ? 'A' : race.isTrainingEvent ? 'C' : 'B')
}

export function raceDistanceKm(race: UpcomingRace): number | null {
  const standard = STANDARD_DISTANCES.find(([, label]) => label === race.distance)
  if (standard) return standard[0]
  const km = /^(\d+(?:\.\d+)?)\s*km$/i.exec(race.distance.trim())
  return km ? Number(km[1]) : null
}

function withFields(base: UpcomingRace, fields: RaceFields): UpcomingRace {
  const kept: UpcomingRace = { ...base }
  delete kept.location
  delete kept.targetSeconds
  delete kept.justFinish
  return {
    ...kept,
    name: fields.name,
    date: fields.date,
    distance: raceDistanceLabel(fields.distanceKm),
    ...(fields.location ? { location: fields.location } : {}),
    targetSeconds: fields.targetSeconds ?? null,
    ...(fields.targetSeconds === undefined ? { justFinish: true as const } : {}),
    priority: fields.priority,
    isPrimaryEvent: fields.priority === 'A',
    isTrainingEvent: fields.priority === 'C',
  }
}

/** Garmin's races with the app's edits and removals applied, then the app's own, by date. */
export function mergeRaces(synced: readonly UpcomingRace[], entries: readonly RaceEntry[]): UpcomingRace[] {
  const overlays = new Map(entries.flatMap((entry) => (entry.garminKey ? [[entry.garminKey, entry] as const] : [])))
  const fromGarmin = synced.flatMap((race) => {
    const entry = overlays.get(raceKey(race))
    if (!entry) return [{ ...race, priority: priorityOf(race) }]
    return 'removed' in entry ? [] : [withFields(race, entry)]
  })
  const added = entries.flatMap((entry) =>
    entry.garminKey || 'removed' in entry ? [] : [withFields({ entryId: entry.id } as UpcomingRace, entry)]
  )
  return [...fromGarmin, ...added].sort((a, b) => a.date.localeCompare(b.date))
}

function goalYearFromEntry(entry: Exclude<GoalEntry, { removed: true }>): GoalYear {
  const targets: GoalTarget[] = RACE_DISTANCES.flatMap((key) => {
    const seconds = entry.targets[key]
    return seconds === undefined ? [] : [{ distance: GOAL_DISTANCE_LABEL[key], targetSeconds: seconds }]
  })
  return { year: entry.year, annualDistanceKm: entry.annualDistanceKm ?? 0, targets }
}

export function mergeGoals(written: readonly GoalYear[], entries: readonly GoalEntry[]): GoalYear[] {
  const edited = new Set(entries.map((entry) => entry.year))
  const fromApp = entries.flatMap((entry) => ('removed' in entry ? [] : [goalYearFromEntry(entry)]))
  return [...written.filter((year) => !edited.has(year.year)), ...fromApp].sort((a, b) => a.year - b.year)
}

export function targetsOf(year: GoalYear): GoalTargets {
  const targets: GoalTargets = {}
  for (const key of RACE_DISTANCES) {
    const target = year.targets.find((candidate) => candidate.distance === GOAL_DISTANCE_LABEL[key])
    if (target) targets[key] = target.targetSeconds
  }
  return targets
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim() !== '' && value.length <= max
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Null for a document the rules would refuse: a hand-edited backup must not reach the plan. */
export function readRaceEntry(id: string, data: unknown): RaceEntry | null {
  if (!isObject(data)) return null
  const garminKey = isText(data.garminKey, ENTRY_LIMITS.garminKeyMax) ? data.garminKey : undefined
  if (data.removed === true) return garminKey ? { id, garminKey, removed: true } : null
  const { name, date, distanceKm, priority, targetSeconds, location } = data
  if (!isText(name, ENTRY_LIMITS.nameMax) || typeof date !== 'string' || !ISO_DATE.test(date)) return null
  if (typeof distanceKm !== 'number' || !(distanceKm >= ENTRY_LIMITS.minKm && distanceKm <= ENTRY_LIMITS.maxKm)) return null
  if (!RACE_PRIORITIES.includes(priority as RacePriority)) return null
  if (targetSeconds !== undefined && !(Number.isInteger(targetSeconds) && (targetSeconds as number) > 0)) return null
  return {
    id,
    ...(garminKey ? { garminKey } : {}),
    name,
    date,
    distanceKm,
    priority: priority as RacePriority,
    ...(typeof targetSeconds === 'number' ? { targetSeconds } : {}),
    ...(isText(location, ENTRY_LIMITS.locationMax) ? { location } : {}),
  }
}

export function readGoalEntry(id: string, data: unknown): GoalEntry | null {
  const year = Number(id)
  if (!/^20\d{2}$/.test(id) || !isObject(data)) return null
  if (data.removed === true) return { year, removed: true }
  if (!isObject(data.targets)) return null
  const { annualDistanceKm } = data
  if (annualDistanceKm !== undefined && !(typeof annualDistanceKm === 'number' && annualDistanceKm > 0)) return null
  const targets: GoalTargets = {}
  for (const key of RACE_DISTANCES) {
    const value = data.targets[key]
    if (value === null || (Number.isInteger(value) && (value as number) > 0)) targets[key] = value as number | null
  }
  return { year, ...(typeof annualDistanceKm === 'number' ? { annualDistanceKm } : {}), targets }
}

/** The document as Firestore stores it, without the id it is filed under. */
export function raceEntryDoc(entry: RaceEntry): Record<string, unknown> {
  const doc: Partial<RaceEntry> = { ...entry }
  delete doc.id
  return doc
}

export function goalEntryDoc(entry: GoalEntry): Record<string, unknown> {
  const doc: Partial<GoalEntry> = { ...entry }
  delete doc.year
  return doc
}

export type RaceDraftError =
  | 'nameRequired'
  | 'nameTooLong'
  | 'dateInvalid'
  | 'datePast'
  | 'dateTooFar'
  | 'distanceRange'
  | 'timeInvalid'
  | 'paceRange'

export interface RaceDraft {
  name: string
  date: string
  /** What the athlete typed: a decimal comma is accepted. */
  distanceKm: string
  justFinish: boolean
  time: string
  priority: RacePriority
  location: string
}

export type RaceDraftField = 'name' | 'date' | 'distance' | 'time'

export type DraftErrors<F extends string> = Partial<Record<F, RaceDraftError>>

export type DraftResult<T, F extends string> = { ok: true; value: T } | { ok: false; errors: DraftErrors<F> }

function parseKm(input: string): number | null {
  const normalized = input.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}

/** h:mm:ss or m:ss, minutes and seconds under 60. */
export function parseRaceTime(input: string): number | null {
  const match = /^(?:(\d{1,2}):([0-5]\d)|(\d{1,3})):([0-5]\d)$/.exec(input.trim())
  if (!match) return null
  const [, hours, minutesWithHours, minutesAlone, seconds] = match
  const total = hours !== undefined
    ? Number(hours) * 3600 + Number(minutesWithHours) * 60 + Number(seconds)
    : Number(minutesAlone) * 60 + Number(seconds)
  return total > 0 ? total : null
}

function timeError(seconds: number | null, km: number): RaceDraftError | null {
  if (seconds === null) return 'timeInvalid'
  const pace = seconds / km
  return pace < ENTRY_LIMITS.minPaceSecPerKm || pace > ENTRY_LIMITS.maxPaceSecPerKm ? 'paceRange' : null
}

const yearOf = (date: string) => Number(date.slice(0, 4))

function isRealDate(date: string): boolean {
  if (!ISO_DATE.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

/** A new race, or a moved one, must still lie ahead; an unchanged date may be today's or one just past. */
export function validateRaceDraft(
  draft: RaceDraft,
  { today, savedDate }: { today: string; savedDate?: string }
): DraftResult<RaceFields, RaceDraftField> {
  const errors: DraftErrors<RaceDraftField> = {}
  const name = draft.name.trim()
  if (name === '') errors.name = 'nameRequired'
  else if (name.length > ENTRY_LIMITS.nameMax) errors.name = 'nameTooLong'

  if (!isRealDate(draft.date)) errors.date = 'dateInvalid'
  else if (draft.date !== savedDate && draft.date < today) errors.date = 'datePast'
  else if (yearOf(draft.date) > yearOf(today) + ENTRY_LIMITS.yearsAhead) errors.date = 'dateTooFar'

  const km = parseKm(draft.distanceKm)
  if (km === null || km < ENTRY_LIMITS.minKm || km > ENTRY_LIMITS.maxKm) errors.distance = 'distanceRange'

  const seconds = draft.justFinish ? null : parseRaceTime(draft.time)
  if (!draft.justFinish && km !== null && !errors.distance) {
    const error = timeError(seconds, km)
    if (error) errors.time = error
  } else if (!draft.justFinish && seconds === null) errors.time = 'timeInvalid'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  const location = draft.location.trim().slice(0, ENTRY_LIMITS.locationMax)
  return {
    ok: true,
    value: {
      name,
      date: draft.date,
      distanceKm: km!,
      priority: draft.priority,
      ...(seconds !== null ? { targetSeconds: seconds } : {}),
      ...(location ? { location } : {}),
    },
  }
}

export type GoalTargetDraft = { kind: 'none' } | { kind: 'finish' } | { kind: 'time'; time: string }

export interface GoalDraft {
  annualKm: string
  targets: Record<RaceDistanceKey, GoalTargetDraft>
}

export type GoalDraftField = 'annualKm' | RaceDistanceKey

export function validateGoalDraft(draft: GoalDraft): DraftResult<{ annualDistanceKm?: number; targets: GoalTargets }, GoalDraftField> {
  const errors: DraftErrors<GoalDraftField> = {}
  const annual = draft.annualKm.trim() === '' ? undefined : parseKm(draft.annualKm)
  if (annual === null || (annual !== undefined && (annual <= 0 || annual > ENTRY_LIMITS.maxAnnualKm))) errors.annualKm = 'distanceRange'

  const targets: GoalTargets = {}
  for (const key of RACE_DISTANCES) {
    const target = draft.targets[key]
    if (target.kind === 'finish') targets[key] = null
    if (target.kind !== 'time') continue
    const seconds = parseRaceTime(target.time)
    const error = timeError(seconds, RACE_DISTANCE_KM[key])
    if (error) errors[key] = error
    else targets[key] = seconds!
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { ...(typeof annual === 'number' ? { annualDistanceKm: annual } : {}), targets } }
}
