import path from 'node:path'
import { diskFiles, type DataFiles } from '../dataFiles'

/**
 * `error`: the app dereferences the field unconditionally, so the build refuses the dataset.
 * `warning`: the app tolerates it, so it is reported and a dataset that renders today never fails the build.
 * The history files and the coaching state are validated by their own readers.
 */
export type Severity = 'error' | 'warning'

export interface Problem {
  file: string
  path: string
  message: string
  severity: Severity
}

type JsonObject = Record<string, unknown>

let files: DataFiles = diskFiles

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-\d{2}$/

// Kept beside the check rather than imported from the domain, so the contract
// is readable in one place and cannot drift silently with a UI-only change.
const KNOWN_ACTIVITY_TYPES = ['Sprint', 'Anaerobic', 'VO2Max', 'Threshold', 'Tempo', 'Base', 'Race']

const NULLABLE_NUMBERS = [
  'paceSecPerKm', 'avgHeartRate', 'rpe', 'elevationGain', 'aerTrainingEffect', 'anaTrainingEffect',
  'calories', 'cadenceSpm', 'groundContactMs', 'verticalOscillationMm', 'verticalRatioPct',
  'strideLengthM', 'vo2maxGarmin', 'avgTemperature', 'gapSecPerKm',
]
const NULLABLE_NUMBER_ARRAYS = ['hrSamples', 'elevationProfile', 'paceSamples', 'cadenceSamples', 'gapSamples']

const isObject = (value: unknown): value is JsonObject =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isIsoDate = (value: unknown): value is string => typeof value === 'string' && ISO_DATE.test(value)
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

class Report {
  readonly problems: Problem[] = []

  constructor(private readonly file: string) {}

  error(at: string, message: string) {
    this.problems.push({ file: this.file, path: at, message, severity: 'error' })
  }

  warn(at: string, message: string) {
    this.problems.push({ file: this.file, path: at, message, severity: 'warning' })
  }

  list(owner: JsonObject, key: string, at: string, { required = true } = {}): unknown[] | null {
    const value = owner[key]
    if (value === undefined && !required) return null
    if (!Array.isArray(value)) {
      this.error(`${at}.${key}`, 'expected an array')
      return null
    }
    return value
  }
}

function readJson(file: string, report: Report): unknown {
  try {
    return files.readJsonSync(file)
  } catch (error) {
    report.error('$', `unreadable: ${(error as Error).message}`)
    return undefined
  }
}

function checkActivity(activity: unknown, at: string, month: string, report: Report): string | null {
  if (!isObject(activity)) {
    report.error(at, 'expected an object')
    return null
  }

  if (!isNonEmptyString(activity.id)) report.error(`${at}.id`, 'expected a non-empty string')
  if (!isIsoDate(activity.date)) report.error(`${at}.date`, 'expected YYYY-MM-DD')
  else if (!activity.date.startsWith(month)) report.error(`${at}.date`, `${activity.date} is filed under ${month}`)

  if (!Number.isInteger(activity.week)) report.warn(`${at}.week`, 'expected an integer')
  if (!isNumber(activity.durationSeconds) || activity.durationSeconds < 0) report.warn(`${at}.durationSeconds`, 'expected a number >= 0')
  if (!isNumber(activity.distanceKm) || activity.distanceKm < 0) report.warn(`${at}.distanceKm`, 'expected a number >= 0')
  for (const key of ['dayOfWeek', 'description', 'comment']) {
    if (typeof activity[key] !== 'string') report.warn(`${at}.${key}`, 'expected a string')
  }

  if (typeof activity.type !== 'string') report.error(`${at}.type`, 'expected a string')
  else if (!KNOWN_ACTIVITY_TYPES.includes(activity.type)) {
    report.warn(`${at}.type`, `unknown activity type "${activity.type}" - it renders with the Base style`)
  }

  const zones = report.list(activity, 'hrZones', at, { required: false })
  zones?.forEach((zone, i) => {
    if (!isObject(zone) || !isNumber(zone.zone) || !isNumber(zone.seconds)) report.warn(`${at}.hrZones[${i}]`, 'expected { zone, seconds, ... }')
  })

  if (activity.route !== null && activity.route !== undefined) {
    if (!Array.isArray(activity.route)) report.error(`${at}.route`, 'expected an array of [lon, lat] or null')
    else {
      const bad = activity.route.findIndex(
        (point) =>
          !Array.isArray(point) || !isNumber(point[0]) || !isNumber(point[1]) ||
          Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90
      )
      if (bad !== -1) report.error(`${at}.route[${bad}]`, 'expected [lon, lat] in range')
    }
  }

  for (const key of NULLABLE_NUMBERS) {
    const value = activity[key]
    if (value !== null && value !== undefined && !isNumber(value)) report.warn(`${at}.${key}`, 'expected a number or null')
  }
  for (const key of NULLABLE_NUMBER_ARRAYS) {
    const value = activity[key]
    if (value !== null && value !== undefined && !(Array.isArray(value) && value.every(isNumber))) {
      report.warn(`${at}.${key}`, 'expected an array of numbers or null')
    }
  }
  if (activity.splits !== null && activity.splits !== undefined && !Array.isArray(activity.splits)) {
    report.error(`${at}.splits`, 'expected an array or null')
  }
  for (const key of ['bestEfforts', 'durationBests', 'weather']) {
    if (activity[key] !== null && activity[key] !== undefined && !isObject(activity[key])) report.error(`${at}.${key}`, 'expected an object or null')
  }

  return isNonEmptyString(activity.id) ? activity.id : null
}

interface MonthCheck {
  problems: Problem[]
  /** By position in the month, null where the id is unusable. */
  ids: (string | null)[]
}

function checkMonth(dir: string, name: string, month: string): MonthCheck {
  const report = new Report(name)
  const file = path.join(dir, name)
  const ids: (string | null)[] = []
  if (!files.existsSync(file)) {
    report.error('$', 'listed in index.json but missing')
  } else {
    const data = readJson(file, report)
    if (data !== undefined) {
      const activities = isObject(data) ? report.list(data, 'activities', '$') : (report.error('$', 'expected an object'), null)
      activities?.forEach((activity, i) => ids.push(checkActivity(activity, `$.activities[${i}]`, month, report)))
    }
  }
  return { problems: report.problems, ids }
}

/** By file and blob: a new commit re-checks only the months it changed. */
let monthChecks = new Map<string, MonthCheck>()

function checkActivities(dir: string, problems: Problem[]) {
  const indexFile = path.join(dir, 'activities', 'index.json')
  if (!files.existsSync(indexFile)) return

  const indexReport = new Report('activities/index.json')
  const index = readJson(indexFile, indexReport)
  const months = isObject(index) ? indexReport.list(index, 'months', '$') : null
  if (index !== undefined && !isObject(index)) indexReport.error('$', 'expected an object')
  for (const month of months ?? []) {
    if (typeof month !== 'string' || !ISO_MONTH.test(month)) indexReport.error('$.months', `bad month "${String(month)}"`)
  }
  problems.push(...indexReport.problems)
  if (!months) return

  const checked = new Map<string, MonthCheck>()
  const seen = new Map<string, string>()
  for (const month of months) {
    if (typeof month !== 'string' || !ISO_MONTH.test(month)) continue
    const name = `activities/${month}.json`
    const sha = files.blobSha(path.join(dir, name))
    const key = sha && `${name}@${sha}`
    const check = (key && monthChecks.get(key)) || checkMonth(dir, name, month)
    if (key) checked.set(key, check)

    const report = new Report(name)
    check.ids.forEach((id, i) => {
      if (!id) return
      if (seen.has(id)) report.error(`$.activities[${i}].id`, `duplicate id ${id}, also in ${seen.get(id)}`)
      else seen.set(id, name)
    })
    problems.push(...check.problems, ...report.problems)
  }
  monthChecks = checked
}

function checkRecords(
  dir: string,
  name: string,
  key: string,
  check: (record: JsonObject, at: string, report: Report) => void,
  problems: Problem[]
) {
  const file = path.join(dir, name)
  if (!files.existsSync(file)) return
  const report = new Report(name)
  const data = readJson(file, report)
  if (data !== undefined) {
    if (!isObject(data)) report.error('$', 'expected an object')
    else {
      report.list(data, key, '$', { required: false })?.forEach((record, i) => {
        if (isObject(record)) check(record, `$.${key}[${i}]`, report)
        else report.error(`$.${key}[${i}]`, 'expected an object')
      })
    }
  }
  problems.push(...report.problems)
}

function checkAthlete(dir: string, problems: Problem[]) {
  const file = path.join(dir, 'athlete.json')
  if (!files.existsSync(file)) return
  const report = new Report('athlete.json')
  const athlete = readJson(file, report)
  if (athlete !== undefined && !isObject(athlete)) report.error('$', 'expected an object')
  if (isObject(athlete)) {
    const numeric = ['lthrBpm', 'thresholdPaceSecPerKm', 'vmaKmh', 'vo2maxMlKgMin', 'weightKg', 'heightCm', 'maxHrBpm',
      'restingHrBpm', 'age', 'fitnessAgeYrs', 'achievableFitnessAgeYrs', 'bmi']
    for (const key of numeric) {
      if (athlete[key] !== undefined && athlete[key] !== null && !isNumber(athlete[key])) report.warn(`$.${key}`, 'expected a number')
    }
    const bounds = athlete.hrZoneBoundsBpm
    if (bounds !== undefined && !(Array.isArray(bounds) && bounds.length === 5 && bounds.every(isNumber))) {
      report.error('$.hrZoneBoundsBpm', 'expected five numbers')
    }
    if (athlete.sex !== undefined && athlete.sex !== 'male' && athlete.sex !== 'female') report.warn('$.sex', 'expected "male" or "female"')
    const injuries = athlete.injuryHistory
    if (injuries !== undefined && !(isObject(injuries) && Array.isArray(injuries.injuries))) {
      report.error('$.injuryHistory', 'expected { reviewedOn, injuries: [] }')
    }
    const breaks = athlete.trainingBreaks
    if (breaks !== undefined && !(Array.isArray(breaks) && breaks.every((item) =>
      isObject(item) && isIsoDate(item.start) && isIsoDate(item.end) && typeof item.reason === 'string'))) {
      report.error('$.trainingBreaks', 'expected [{ start, end, reason }] with YYYY-MM-DD dates')
    }
  }
  problems.push(...report.problems)
}

function checkPlannedWorkouts(dir: string, problems: Problem[]) {
  const plannedDir = path.join(dir, 'planned_workouts')
  if (!files.existsSync(plannedDir)) return
  for (const name of files.readdirSync(plannedDir).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
    checkRecords(dir, `planned_workouts/${name}`, 'planned', (workout, at, report) => {
      if (!isIsoDate(workout.date)) report.error(`${at}.date`, 'expected YYYY-MM-DD')
      if (typeof workout.name !== 'string') report.error(`${at}.name`, 'expected a string')
      if (workout.type !== undefined && !KNOWN_ACTIVITY_TYPES.includes(workout.type as string)) {
        report.warn(`${at}.type`, `unknown activity type "${String(workout.type)}"`)
      }
      if (workout.steps !== undefined && !Array.isArray(workout.steps)) report.error(`${at}.steps`, 'expected an array')
    }, problems)
  }
}

function checkCrossTraining(dir: string, problems: Problem[]) {
  const sessionsDir = path.join(dir, 'cross_training')
  if (!files.existsSync(sessionsDir)) return
  for (const name of files.readdirSync(sessionsDir).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
    const year = name.slice(0, -'.json'.length)
    checkRecords(dir, `cross_training/${name}`, 'sessions', (session, at, report) => {
      if (!isNonEmptyString(session.id)) report.error(`${at}.id`, 'expected a non-empty string')
      if (!isIsoDate(session.date)) report.error(`${at}.date`, 'expected YYYY-MM-DD')
      else if (!session.date.startsWith(year)) report.error(`${at}.date`, `${session.date} is filed under ${year}`)
      if (typeof session.sport !== 'string') report.warn(`${at}.sport`, 'expected a string')
      if (!isNumber(session.durationSeconds) || session.durationSeconds < 0) report.warn(`${at}.durationSeconds`, 'expected a number >= 0')
      for (const key of ['distanceKm', 'avgHeartRate', 'trainingLoad']) {
        if (session[key] !== null && session[key] !== undefined && !isNumber(session[key])) report.warn(`${at}.${key}`, 'expected a number or null')
      }
      if (session.sets !== undefined && !Array.isArray(session.sets)) report.warn(`${at}.sets`, 'expected an array')
    }, problems)
  }
}

export function checkDataDirectory(dir: string, using: DataFiles = diskFiles): Problem[] {
  files = using
  try {
    return checkAll(dir)
  } finally {
    files = diskFiles
  }
}

function checkAll(dir: string): Problem[] {
  const problems: Problem[] = []

  checkActivities(dir, problems)
  checkAthlete(dir, problems)

  checkRecords(dir, 'goals.json', 'years', (year, at, report) => {
    if (!Number.isInteger(year.year)) report.error(`${at}.year`, 'expected an integer')
    if (!isNumber(year.annualDistanceKm)) report.warn(`${at}.annualDistanceKm`, 'expected a number')
    report.list(year, 'targets', at)?.forEach((target, i) => {
      if (!isObject(target) || typeof target.distance !== 'string') report.error(`${at}.targets[${i}]`, 'expected { distance, target }')
    })
  }, problems)

  checkRecords(dir, 'pbs.json', 'years', (year, at, report) => {
    if (!Number.isInteger(year.year)) report.error(`${at}.year`, 'expected an integer')
    report.list(year, 'entries', at)?.forEach((entry, i) => {
      if (!isObject(entry) || typeof entry.distance !== 'string' || typeof entry.time !== 'string') {
        report.error(`${at}.entries[${i}]`, 'expected { distance, time, activityId }')
      }
    })
  }, problems)

  checkRecords(dir, 'upcoming_races.json', 'races', (race, at, report) => {
    if (!isIsoDate(race.date)) report.error(`${at}.date`, 'expected YYYY-MM-DD')
    if (typeof race.name !== 'string') report.error(`${at}.name`, 'expected a string')
    if (typeof race.distance !== 'string') report.error(`${at}.distance`, 'expected a string')
  }, problems)

  checkRecords(dir, 'shoes.json', 'shoes', (shoe, at, report) => {
    for (const key of ['gearId', 'brand', 'model']) {
      if (typeof shoe[key] !== 'string') report.error(`${at}.${key}`, 'expected a string')
    }
    if (!isNumber(shoe.maxKm)) report.warn(`${at}.maxKm`, 'expected a number')
    if (typeof shoe.retired !== 'boolean') report.warn(`${at}.retired`, 'expected a boolean')
  }, problems)

  checkPlannedWorkouts(dir, problems)
  checkCrossTraining(dir, problems)

  const syncMeta = path.join(dir, 'sync_meta.json')
  if (files.existsSync(syncMeta)) {
    const report = new Report('sync_meta.json')
    const meta = readJson(syncMeta, report)
    if (meta !== undefined && !(isObject(meta) && typeof meta.lastSyncedAt === 'string' && !Number.isNaN(Date.parse(meta.lastSyncedAt)))) {
      report.error('$.lastSyncedAt', 'expected an ISO timestamp')
    }
    problems.push(...report.problems)
  }

  return problems
}
