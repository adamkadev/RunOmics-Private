import { DAY_MS } from '@/lib/calendarDate'
import ExcelJS from 'exceljs'
import type { Activity, ActivitySplit, PlannedWorkout } from '@/domain/activity/types'
import type { AthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import type { AthleteHistoryEntry } from '@/infrastructure/repositories/JsonAthleteHistoryRepository'
import type { GoalYear, PbYear, UpcomingRaceYear } from './GetGoalsData'
import type { RacePredictionDay } from '@/infrastructure/repositories/JsonRacePredictionRepository'
import type { ShoeRecord } from '@/domain/shoe/types'
import type { ThresholdSample } from '@/infrastructure/repositories/JsonThresholdHistoryRepository'
import type { TrainingLoadBalance } from '@/infrastructure/repositories/JsonTrainingLoadBalanceRepository'
import type { TrainingPlanRaw } from '@/infrastructure/repositories/JsonTrainingPlanRepository'
import type { TrainingStatusDay } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import type { Vo2maxSamples } from '@/infrastructure/repositories/JsonVo2maxHistoryRepository'
import { aerobicDecoupling } from '@/domain/activity/decoupling'
import { MIN_REP_SECONDS, repStats, sessionExecution } from '@/domain/activity/sessionExecution'
import { trimp, DEFAULT_HR_BOUNDS, type HrBounds } from '@/domain/training/trimp'
import { loadSeries } from '@/domain/training/loadSeries'
import { round } from '@/lib/math'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteHistory } from '@/infrastructure/repositories/JsonAthleteHistoryRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { getGoalYears } from '@/infrastructure/repositories/JsonGoalRepository'
import { getPbYears } from '@/infrastructure/repositories/JsonPbRepository'
import { getAllPlannedWorkouts } from '@/infrastructure/repositories/JsonPlannedWorkoutRepository'
import { getRacePredictionDays } from '@/infrastructure/repositories/JsonRacePredictionRepository'
import { getShoeRecords } from '@/infrastructure/repositories/JsonShoeRepository'
import { getThresholdSamples } from '@/infrastructure/repositories/JsonThresholdHistoryRepository'
import { getTrainingLoadBalance } from '@/infrastructure/repositories/JsonTrainingLoadBalanceRepository'
import { getTrainingPlan } from '@/infrastructure/repositories/JsonTrainingPlanRepository'
import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { getUpcomingRaceYears } from '@/infrastructure/repositories/JsonUpcomingRaceRepository'
import { getVo2maxSamples } from '@/infrastructure/repositories/JsonVo2maxHistoryRepository'

export const TRAINING_WORKBOOK_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const SCHEMA_VERSION = '1.0'
const HEADER_FILL = '17324D'
const HEADER_TEXT = 'FFFFFF'
const ACCENT = '37B6A5'

type Primitive = string | number | boolean | Date | null
type RowData = Record<string, Primitive>

interface ColumnDefinition {
  key: string
  width?: number
  numberFormat?: string
  wrap?: boolean
}

export interface TrainingWorkbookData {
  activities: Activity[]
  athlete: AthleteProfile
  athleteHistory: AthleteHistoryEntry[]
  goals: GoalYear[]
  pbs: PbYear[]
  plannedWorkouts: PlannedWorkout[]
  racePredictions: RacePredictionDay[]
  shoes: ShoeRecord[]
  thresholdHistory: ThresholdSample[]
  trainingLoadBalance: TrainingLoadBalance | null
  trainingPlan: TrainingPlanRaw | null
  trainingStatus: TrainingStatusDay[]
  upcomingRaces: UpcomingRaceYear[]
  vo2maxHistory: Vo2maxSamples
}

const DATE_COLUMN: Pick<ColumnDefinition, 'width' | 'numberFormat'> = {
  width: 13,
  numberFormat: 'yyyy-mm-dd',
}

const DISTANCE_KM: Record<string, number> = {
  '1K': 1,
  '1 Mile': 1.60934,
  '5K': 5,
  '10K': 10,
  'Half-Marathon': 21.0975,
  Marathon: 42.195,
}

const RACE_KEYS = [
  ['5k', 5],
  ['10k', 10],
  ['half', 21.0975],
  ['marathon', 42.195],
] as const

function excelDate(date: string | null | undefined): Date | null {
  if (!date) return null
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function dateRange(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00.000Z`).getTime()
  const end = new Date(`${to}T00:00:00.000Z`).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return []
  const dates: string[] = []
  for (let timestamp = start; timestamp <= end; timestamp += DAY_MS) dates.push(utcDate(new Date(timestamp)))
  return dates
}

function maxDate(dates: Array<string | null | undefined>, fallback: string): string {
  return dates.filter((date): date is string => Boolean(date)).reduce((max, date) => date > max ? date : max, fallback)
}

function groupByDate<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const item of items) grouped.set(item.date, [...(grouped.get(item.date) ?? []), item])
  return grouped
}

function minDate(dates: Array<string | null | undefined>, fallback: string): string {
  return dates.filter((date): date is string => Boolean(date)).reduce((min, date) => date < min ? date : min, fallback)
}

function tableName(sheetName: string): string {
  return `Export${sheetName.replace(/[^A-Za-z0-9]/g, '')}`
}

function addDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: ColumnDefinition[],
  rows: RowData[],
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 19 },
  })
  sheet.properties.tabColor = { argb: ACCENT }
  sheet.pageSetup = { orientation: columns.length > 10 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1 }

  const values = rows.map((row) => columns.map((column) => row[column.key] ?? null))
  sheet.addTable({
    name: tableName(name),
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: columns.map((column) => ({ name: column.key, filterButton: true })),
    rows: values,
  })

  columns.forEach((column, index) => {
    const excelColumn = sheet.getColumn(index + 1)
    excelColumn.width = Math.min(column.width ?? Math.max(12, column.key.length + 2), 42)
    if (column.numberFormat) excelColumn.numFmt = column.numberFormat
    if (column.wrap) excelColumn.alignment = { vertical: 'top', wrapText: true }
  })

  const header = sheet.getRow(1)
  header.height = 28
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.font = { bold: true, color: { argb: HEADER_TEXT } }
    cell.alignment = { vertical: 'middle' }
    cell.border = { bottom: { style: 'medium', color: { argb: ACCENT } } }
  })

  return sheet
}

function hrZoneSeconds(activity: Activity, zone: number): number | null {
  return activity.hrZones.find((item) => item.zone === zone)?.seconds ?? null
}

function hardMinutes(activity: Activity): number | null {
  if (!activity.hrZones.length) return null
  return round(activity.hrZones.filter((zone) => zone.zone >= 4).reduce((sum, zone) => sum + zone.seconds, 0) / 60, 1)
}

function phaseForDate(plan: TrainingPlanRaw | null, date: string): string | null {
  return plan?.phases.find((phase) => date >= phase.startDate && date <= phase.endDate)?.phase ?? null
}

function raceKeyForDistance(distance: string | number): typeof RACE_KEYS[number][0] | null {
  const km = typeof distance === 'number' ? distance : DISTANCE_KM[distance]
  if (km === undefined) return null
  return RACE_KEYS.find(([, expected]) => Math.abs(expected - km) <= Math.max(0.15, expected * 0.02))?.[0] ?? null
}

function distanceForRecord(label: string): number | null {
  return DISTANCE_KM[label] ?? null
}

function currentPrediction(
  predictions: RacePredictionDay[],
  distance: string | number,
): number | null {
  const key = raceKeyForDistance(distance)
  if (!key) return null
  for (let index = predictions.length - 1; index >= 0; index--) {
    const predictedSeconds = predictions[index]?.[key]
    if (predictedSeconds !== undefined) return predictedSeconds
  }
  return null
}

function buildLoadSeries(activities: Activity[], through: string, hrBounds: HrBounds) {
  const daily = new Map<string, number>()
  for (const activity of activities) {
    daily.set(activity.date, (daily.get(activity.date) ?? 0) + trimp(activity, hrBounds))
  }

  const first = activities.reduce<string | null>((min, activity) => min === null || activity.date < min ? activity.date : min, null)
  const series = new Map<string, { trimp: number; ctl: number; atl: number; tsb: number }>()
  if (!first) return series

  for (const [date, day] of loadSeries(daily, first, through)) {
    series.set(date, { trimp: round(day.load, 1), ctl: round(day.ctl, 1), atl: round(day.atl, 1), tsb: round(day.tsb, 1) })
  }
  return series
}

function guideRows(generatedAt: Date): RowData[] {
  return [
    { section: 'Export', item: 'schema_version', description: SCHEMA_VERSION },
    { section: 'Export', item: 'generated_at_utc', description: generatedAt.toISOString() },
    { section: 'Export', item: 'source', description: 'Runomics training data' },
    { section: 'Usage', item: 'intended_audience', description: 'Athlete, running coach, or LLM-based training analysis' },
    { section: 'Usage', item: 'missing_values', description: 'Blank cells mean the source did not provide a reliable value.' },
    { section: 'Usage', item: 'units', description: 'Units are included in column names. Pace and finish times remain numeric seconds for analysis.' },
    { section: 'Privacy', item: 'location_data', description: 'Route coordinates and encoded polylines are intentionally excluded.' },
    { section: 'Privacy', item: 'raw_samples', description: 'Raw heart-rate, pace, cadence, and elevation arrays are excluded; useful summaries are exported instead.' },
    { section: 'Caveat', item: 'daily_plan_completion', description: 'planned_day_completed only means at least one activity occurred on a planned date; it does not prove the prescribed workout was followed.' },
    { section: 'Sheet', item: 'Athlete', description: 'Current athlete profile and physiological reference values.' },
    { section: 'Sheet', item: 'Activities', description: 'One row per activity with conditions, intensity, execution, records, and gear.' },
    { section: 'Sheet', item: 'Intervals', description: 'One row per segment of a workout with reps or strides - warm-up, each rep or stride, each recovery, cool-down - with its own pace and heart rate.' },
    { section: 'Sheet', item: 'Daily Status', description: 'One row per calendar day, including rest days, with load, status, plan, and race context.' },
    { section: 'Sheet', item: 'Records', description: 'Official yearly personal bests plus locally derived records when no official record exists.' },
    { section: 'Sheet', item: 'Races', description: 'Completed race activities and calendar races, joined when date and distance match.' },
    { section: 'Sheet', item: 'Training Plan', description: 'Current plan metadata and prescribed workouts.' },
    { section: 'Sheet', item: 'Fitness History', description: 'VO2max, lactate-threshold, threshold-pace, fitness-age, and weight history.' },
    { section: 'Sheet', item: 'Race Predictions', description: 'Garmin race prediction history in seconds.' },
    { section: 'Sheet', item: 'Shoes', description: 'Shoe lifecycle and distance accumulated in exported activities.' },
    { section: 'Sheet', item: 'Goals', description: 'Annual volume and race-time targets with observed progress.' },
    { section: 'Sheet', item: 'Load Balance', description: 'Latest Garmin four-week intensity balance and personalised target ranges.' },
  ]
}

function athleteRows(athlete: AthleteProfile): RowData[] {
  const zones = athlete.hrZoneBoundsBpm ?? []
  return [{
    display_name: athlete.displayName ?? null,
    age_years: athlete.age ?? null,
    sex: athlete.sex ?? null,
    height_cm: athlete.heightCm ?? null,
    weight_kg: athlete.weightKg ?? null,
    bmi: athlete.bmi ?? null,
    resting_hr_bpm: athlete.restingHrBpm ?? null,
    max_hr_bpm: athlete.maxHrBpm ?? null,
    lactate_threshold_hr_bpm: athlete.lthrBpm ?? null,
    threshold_pace_sec_per_km: athlete.thresholdPaceSecPerKm ?? null,
    vma_kmh: athlete.vmaKmh ?? null,
    vo2max_ml_kg_min: athlete.vo2maxMlKgMin ?? null,
    fitness_age_years: athlete.fitnessAgeYrs ?? null,
    achievable_fitness_age_years: athlete.achievableFitnessAgeYrs ?? null,
    hr_zone_1_upper_bpm: zones[0] ?? null,
    hr_zone_2_upper_bpm: zones[1] ?? null,
    hr_zone_3_upper_bpm: zones[2] ?? null,
    hr_zone_4_upper_bpm: zones[3] ?? null,
    hr_zone_5_upper_bpm: zones[4] ?? null,
    device_name: athlete.deviceName ?? null,
    device_since: excelDate(athlete.deviceSince),
    last_profile_update: excelDate(athlete.lastUpdate),
  }]
}

function activityRows(data: TrainingWorkbookData, hrBounds: HrBounds): RowData[] {
  const shoes = new Map(data.shoes.map((shoe) => [shoe.gearId, shoe]))
  return [...data.activities].sort((a, b) => a.date.localeCompare(b.date)).map((activity) => {
    const decoupling = aerobicDecoupling(activity)
    const execution = sessionExecution(activity)
    const reps = repStats(activity)
    const shoe = activity.gearId ? shoes.get(activity.gearId) : undefined
    return {
      activity_id: activity.id,
      date: excelDate(activity.date),
      day_of_week: activity.dayOfWeek,
      iso_week: activity.week,
      type: activity.type,
      type_source: activity.typeSource ?? null,
      description: activity.description,
      duration_seconds: activity.durationSeconds,
      distance_km: activity.distanceKm,
      pace_sec_per_km: activity.paceSecPerKm,
      avg_heart_rate_bpm: activity.avgHeartRate,
      rpe_1_10: activity.rpe,
      elevation_gain_m: activity.elevationGain,
      aerobic_training_effect: activity.aerTrainingEffect,
      anaerobic_training_effect: activity.anaTrainingEffect,
      trimp: round(trimp(activity, hrBounds), 1),
      calories_kcal: activity.calories,
      cadence_spm: activity.cadenceSpm,
      ground_contact_ms: activity.groundContactMs,
      vertical_oscillation_mm: activity.verticalOscillationMm,
      vertical_ratio_pct: activity.verticalRatioPct,
      stride_length_m: activity.strideLengthM,
      vo2max: activity.vo2maxGarmin,
      watch_temperature_c: activity.avgTemperature,
      hr_zone_1_seconds: hrZoneSeconds(activity, 1),
      hr_zone_2_seconds: hrZoneSeconds(activity, 2),
      hr_zone_3_seconds: hrZoneSeconds(activity, 3),
      hr_zone_4_seconds: hrZoneSeconds(activity, 4),
      hr_zone_5_seconds: hrZoneSeconds(activity, 5),
      hard_minutes_z4_z5: hardMinutes(activity),
      weather_temperature_c: activity.weather?.tempC ?? null,
      weather_apparent_temperature_c: activity.weather?.apparentTempC ?? null,
      weather_humidity_pct: activity.weather?.humidityPct ?? null,
      weather_wind_kph: activity.weather?.windKph ?? null,
      weather_wind_direction_deg: activity.weather?.windDirDeg ?? null,
      weather_precipitation_mm: activity.weather?.precipitationMm ?? null,
      weather_code_wmo: activity.weather?.code ?? null,
      gear_id: activity.gearId,
      shoe_brand: shoe?.brand ?? null,
      shoe_model: shoe?.model ?? null,
      best_effort_1k_seconds: activity.bestEfforts?.['1k'] ?? null,
      best_effort_1_mile_seconds: activity.bestEfforts?.['1mile'] ?? null,
      best_effort_5k_seconds: activity.bestEfforts?.['5k'] ?? null,
      best_effort_10k_seconds: activity.bestEfforts?.['10k'] ?? null,
      best_effort_half_marathon_seconds: activity.bestEfforts?.half ?? null,
      best_effort_marathon_seconds: activity.bestEfforts?.marathon ?? null,
      aerobic_decoupling_pct: decoupling?.percent ?? null,
      aerobic_decoupling_status: decoupling?.drift ?? null,
      execution_kind: execution?.kind ?? null,
      execution_reps: execution?.kind === 'intervals' ? execution.reps : null,
      execution_fade_sec_per_km: execution?.kind === 'intervals' ? execution.fadeSecPerKm : null,
      execution_spread_sec_per_km: execution?.spreadSecPerKm ?? null,
      execution_hr_drift_bpm: execution?.hrDriftBpm ?? null,
      execution_rep_paces_sec_per_km: execution?.kind === 'intervals' ? execution.repPaces.join(' | ') : null,
      execution_rep_avg_pace_sec_per_km: reps?.paceSecPerKm ?? null,
      execution_rep_avg_hr_bpm: reps?.avgHr ?? null,
      execution_rep_avg_seconds: reps?.secondsPerRep ?? null,
      comment: activity.comment || null,
    }
  })
}

const SEGMENT: Record<Exclude<ActivitySplit['type'], 'lap'>, string> = {
  interval_warmup: 'warmup',
  interval_active: 'rep',
  interval_rest: 'recovery',
  interval_recovery: 'recovery',
  interval_cooldown: 'cooldown',
}

/**
 * Each structured segment on its own row, so a session reads rep by rep
 * rather than through a whole-run average that the warm-up and recoveries
 * dilute. Reps and strides are told apart as sessionExecution does: a short
 * effort beside a continuous block is a stride, and a single continuous
 * block is the run itself rather than one rep. Sessions with neither reps nor
 * strides are left out, since one row would only repeat the Activities sheet.
 */
function intervalRows(data: TrainingWorkbookData): RowData[] {
  return [...data.activities].sort((a, b) => a.date.localeCompare(b.date)).flatMap((activity) => {
    const segments = (activity.splits ?? []).filter((split) => split.type !== 'lap')
    const active = segments.filter((split) => split.type === 'interval_active')
    const continuous = active.filter((split) => split.durationSec >= MIN_REP_SECONDS).length
    const segmentOf = (split: ActivitySplit): string => {
      if (split.type !== 'interval_active') return SEGMENT[split.type as keyof typeof SEGMENT]
      if (split.durationSec < MIN_REP_SECONDS) return continuous ? 'stride' : 'rep'
      return continuous >= 2 ? 'rep' : 'steady'
    }
    const labelled = segments.map((split) => ({ split, segment: segmentOf(split) }))
    if (!labelled.some(({ segment }) => segment === 'rep' || segment === 'stride')) return []

    const counts = { rep: 0, stride: 0 }
    return labelled.map(({ split, segment }, index) => {
      const counted = segment === 'rep' || segment === 'stride'
      if (counted) counts[segment] += 1
      return {
        activity_id: activity.id,
        date: excelDate(activity.date),
        description: activity.description,
        segment_index: index + 1,
        segment,
        rep_index: counted ? counts[segment] : null,
        duration_seconds: round(split.durationSec, 0),
        distance_m: round(split.distanceM, 0),
        pace_sec_per_km: split.distanceM > 0 ? round((split.durationSec / split.distanceM) * 1000, 0) : null,
        avg_heart_rate_bpm: split.avgHr,
      }
    })
  })
}

function dailyRows(data: TrainingWorkbookData, generatedAt: Date, hrBounds: HrBounds): RowData[] {
  const today = utcDate(generatedAt)
  const calendarRaces = data.upcomingRaces.flatMap((year) => year.races)
  const candidateDates = [
    ...data.activities.map((item) => item.date),
    ...data.trainingStatus.map((item) => item.date),
    ...data.plannedWorkouts.map((item) => item.date),
    ...calendarRaces.map((item) => item.date),
    data.trainingPlan?.startDate,
    data.trainingPlan?.endDate,
  ]
  const from = minDate(candidateDates, today)
  const to = maxDate(candidateDates, today)
  const activitiesByDate = groupByDate(data.activities)
  const plannedByDate = groupByDate(data.plannedWorkouts)
  const racesByDate = groupByDate(calendarRaces)
  const statuses = new Map(data.trainingStatus.map((status) => [status.date, status]))
  const load = buildLoadSeries(data.activities, today, hrBounds)

  return dateRange(from, to).map((date) => {
    const activities = activitiesByDate.get(date) ?? []
    const planned = plannedByDate.get(date) ?? []
    const races = racesByDate.get(date) ?? []
    const status = statuses.get(date)
    const local = load.get(date)
    return {
      date: excelDate(date),
      actual_activity_count: activities.length,
      actual_distance_km: round(activities.reduce((sum, activity) => sum + activity.distanceKm, 0), 2),
      actual_duration_seconds: activities.reduce((sum, activity) => sum + activity.durationSeconds, 0),
      daily_trimp: local?.trimp ?? 0,
      fitness_ctl: local?.ctl ?? null,
      fatigue_atl: local?.atl ?? null,
      form_tsb_start_of_day: local?.tsb ?? null,
      garmin_training_status: status?.status ?? null,
      garmin_feedback: status?.feedback ?? null,
      garmin_fitness_trend: status?.fitnessTrend ?? null,
      garmin_acute_load: status?.acuteLoad ?? null,
      garmin_chronic_load: status?.chronicLoad ?? null,
      garmin_acwr: status?.acwr ?? null,
      garmin_acwr_status: status?.acwrStatus ?? null,
      garmin_chronic_load_min: status?.chronicLoadMin ?? null,
      garmin_chronic_load_max: status?.chronicLoadMax ?? null,
      planned_workout_count: planned.length,
      planned_workout_names: planned.map((workout) => workout.name).join(' | ') || null,
      planned_day_completed: planned.length ? activities.length > 0 : null,
      training_plan_phase: phaseForDate(data.trainingPlan, date),
      race_names: races.map((race) => race.name).join(' | ') || null,
    }
  })
}

function recordRows(data: TrainingWorkbookData): RowData[] {
  const activities = new Map(data.activities.map((activity) => [activity.id, activity]))
  const official = data.pbs.flatMap((year) => year.entries.map((entry) => ({ ...entry, year: year.year })))
  const bestOfficial = new Map<string, number>()
  for (const entry of official) {
    const current = bestOfficial.get(entry.distance)
    if (current === undefined || entry.seconds < current) bestOfficial.set(entry.distance, entry.seconds)
  }

  const rows: RowData[] = official.map((entry) => {
    const activity = activities.get(entry.activityId)
    const distanceKm = distanceForRecord(entry.distance)
    return {
      record_key: entry.distance,
      year: entry.year,
      distance_label: entry.distance,
      distance_km: distanceKm,
      time_seconds: entry.seconds,
      pace_sec_per_km: distanceKm ? round(entry.seconds / distanceKm, 1) : null,
      activity_id: entry.activityId || null,
      activity_date: excelDate(activity?.date),
      event_name: activity?.description ?? null,
      official: true,
      is_all_time: bestOfficial.get(entry.distance) === entry.seconds,
    }
  })

  const knownOfficial = new Set(official.map((entry) => entry.distance))
  const effortLabels: Record<string, string> = {
    '1k': '1K', '1mile': '1 Mile', '5k': '5K', '10k': '10K', half: 'Half-Marathon', marathon: 'Marathon',
  }
  for (const [key, label] of Object.entries(effortLabels)) {
    if (knownOfficial.has(label)) continue
    const best = data.activities
      .flatMap((activity) => activity.bestEfforts?.[key] !== undefined ? [{ activity, seconds: activity.bestEfforts[key]! }] : [])
      .sort((a, b) => a.seconds - b.seconds)[0]
    if (!best) continue
    const distanceKm = distanceForRecord(label)
    rows.push({
      record_key: label,
      year: Number(best.activity.date.slice(0, 4)),
      distance_label: label,
      distance_km: distanceKm,
      time_seconds: round(best.seconds, 1),
      pace_sec_per_km: distanceKm ? round(best.seconds / distanceKm, 1) : null,
      activity_id: best.activity.id,
      activity_date: excelDate(best.activity.date),
      event_name: best.activity.description,
      official: false,
      is_all_time: true,
    })
  }

  const longest = [...data.activities].filter((activity) => activity.distanceKm > 0).sort((a, b) => b.distanceKm - a.distanceKm)[0]
  if (longest) {
    rows.push({
      record_key: 'longest',
      year: Number(longest.date.slice(0, 4)),
      distance_label: 'Longest activity',
      distance_km: longest.distanceKm,
      time_seconds: longest.durationSeconds,
      pace_sec_per_km: longest.paceSecPerKm,
      activity_id: longest.id,
      activity_date: excelDate(longest.date),
      event_name: longest.description,
      official: false,
      is_all_time: true,
    })
  }

  return rows.sort((a, b) => String(a.record_key).localeCompare(String(b.record_key)) || Number(a.year) - Number(b.year))
}

function raceRows(data: TrainingWorkbookData, generatedAt: Date): RowData[] {
  const today = utcDate(generatedAt)
  const raceActivities = data.activities.filter((activity) => activity.type === 'Race')
  const matchedActivities = new Set<string>()
  const rows: RowData[] = []

  for (const race of data.upcomingRaces.flatMap((year) => year.races)) {
    const distanceKm = DISTANCE_KM[race.distance] ?? null
    const match = raceActivities.find((activity) =>
      activity.date === race.date &&
      distanceKm !== null &&
      Math.abs(activity.distanceKm - distanceKm) <= Math.max(0.2, distanceKm * 0.03)
    )
    if (match) matchedActivities.add(match.id)
    rows.push({
      status: match ? 'completed' : race.date >= today ? 'upcoming' : 'calendar_only',
      date: excelDate(race.date),
      name: race.name,
      distance_label: race.distance,
      distance_km: distanceKm,
      location: race.location ?? null,
      target_time_seconds: race.targetSeconds ?? null,
      predicted_time_seconds: currentPrediction(data.racePredictions, race.distance),
      actual_time_seconds: match?.durationSeconds ?? null,
      activity_id: match?.id ?? null,
    })
  }

  for (const activity of raceActivities.filter((activity) => !matchedActivities.has(activity.id))) {
    rows.push({
      status: 'completed',
      date: excelDate(activity.date),
      name: activity.description,
      distance_label: null,
      distance_km: activity.distanceKm,
      location: null,
      target_time_seconds: null,
      predicted_time_seconds: currentPrediction(data.racePredictions, activity.distanceKm),
      actual_time_seconds: activity.durationSeconds,
      activity_id: activity.id,
    })
  }

  return rows.sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime())
}

function trainingPlanRows(data: TrainingWorkbookData): RowData[] {
  if (!data.trainingPlan && !data.plannedWorkouts.length) return []
  const workouts = data.plannedWorkouts.length ? data.plannedWorkouts : [null]
  return workouts.map((workout) => ({
    plan_id: data.trainingPlan?.planId ?? null,
    plan_name: data.trainingPlan?.name ?? null,
    plan_start_date: excelDate(data.trainingPlan?.startDate),
    plan_end_date: excelDate(data.trainingPlan?.endDate),
    workout_date: excelDate(workout?.date),
    phase: workout ? phaseForDate(data.trainingPlan, workout.date) : null,
    workout_name: workout?.name ?? null,
    workout_type: workout?.type ?? null,
    planned_distance_m: workout?.distanceM ?? null,
    planned_duration_seconds: workout?.durationSecs ?? null,
    scheduled_time_of_day: workout?.scheduledTime ?? null,
    estimated_load: workout?.estimatedLoad ?? null,
    load_is_estimated: workout?.isEstimated ?? null,
    steps_json: workout?.steps ? JSON.stringify(workout.steps) : null,
  }))
}

function fitnessHistoryRows(data: TrainingWorkbookData): RowData[] {
  const rows = new Map<string, RowData>()
  const ensure = (date: string) => {
    const existing = rows.get(date)
    if (existing) return existing
    const created: RowData = {
      date: excelDate(date), vo2max_ml_kg_min: null, fitness_age_years: null,
      lactate_threshold_hr_bpm: null, threshold_pace_sec_per_km: null, weight_kg: null, sources: '',
    }
    rows.set(date, created)
    return created
  }
  const addSource = (row: RowData, source: string) => {
    const sources = String(row.sources || '').split(' | ').filter(Boolean)
    if (!sources.includes(source)) sources.push(source)
    row.sources = sources.join(' | ')
  }

  for (const entry of data.athleteHistory) {
    const row = ensure(entry.date)
    row.vo2max_ml_kg_min = entry.vo2maxMlKgMin ?? row.vo2max_ml_kg_min ?? null
    row.lactate_threshold_hr_bpm = entry.lthrBpm ?? row.lactate_threshold_hr_bpm ?? null
    row.threshold_pace_sec_per_km = entry.thresholdPaceSecPerKm ?? row.threshold_pace_sec_per_km ?? null
    row.weight_kg = entry.weightKg ?? row.weight_kg ?? null
    addSource(row, 'athlete_history')
  }
  for (const entry of data.thresholdHistory) {
    const row = ensure(entry.date)
    row.lactate_threshold_hr_bpm = entry.lthrBpm ?? row.lactate_threshold_hr_bpm ?? null
    row.threshold_pace_sec_per_km = entry.thresholdPaceSecPerKm ?? row.threshold_pace_sec_per_km ?? null
    addSource(row, 'threshold_history')
  }
  for (const entry of data.vo2maxHistory.days) {
    const row = ensure(entry.date)
    row.vo2max_ml_kg_min = entry.vo2max
    row.fitness_age_years = entry.fitnessAge ?? row.fitness_age_years ?? null
    addSource(row, 'vo2max_history')
  }
  return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row)
}

function racePredictionRows(predictions: RacePredictionDay[]): RowData[] {
  return predictions.map((prediction) => ({
    date: excelDate(prediction.date),
    predicted_5k_seconds: prediction['5k'] ?? null,
    predicted_10k_seconds: prediction['10k'] ?? null,
    predicted_half_marathon_seconds: prediction.half ?? null,
    predicted_marathon_seconds: prediction.marathon ?? null,
  }))
}

function shoeRows(data: TrainingWorkbookData): RowData[] {
  return data.shoes.map((shoe) => {
    const activities = data.activities.filter((activity) => activity.gearId === shoe.gearId)
    const totalKm = round(activities.reduce((sum, activity) => sum + activity.distanceKm, 0), 1)
    return {
      gear_id: shoe.gearId,
      brand: shoe.brand,
      model: shoe.model,
      first_use_date: excelDate(shoe.firstUseDate),
      activity_count: activities.length,
      total_distance_km: totalKm,
      max_distance_km: shoe.maxKm,
      remaining_distance_km: round(Math.max(0, shoe.maxKm - totalKm), 1),
      wear_pct: shoe.maxKm > 0 ? totalKm / shoe.maxKm : null,
      retired: shoe.retired,
    }
  })
}

function goalRows(data: TrainingWorkbookData): RowData[] {
  const pbsByYear = new Map(data.pbs.map((year) => [year.year, new Map(year.entries.map((entry) => [entry.distance, entry.seconds]))]))
  return data.goals.flatMap((goal) => {
    const actualKm = round(data.activities.filter((activity) => activity.date.startsWith(`${goal.year}-`)).reduce((sum, activity) => sum + activity.distanceKm, 0), 1)
    const targets = goal.targets.length ? goal.targets : [{ distance: null, targetSeconds: null }]
    return targets.map((target) => {
      const record = target.distance ? pbsByYear.get(goal.year)?.get(target.distance) ?? null : null
      return {
        year: goal.year,
        annual_distance_goal_km: goal.annualDistanceKm,
        actual_distance_km: actualKm,
        annual_goal_progress_pct: goal.annualDistanceKm > 0 ? actualKm / goal.annualDistanceKm : null,
        target_distance: target.distance,
        target_time_seconds: target.targetSeconds,
        best_time_seconds: record,
        target_achieved: target.targetSeconds !== null && record !== null ? record <= target.targetSeconds : null,
      }
    })
  })
}

function loadBalanceRows(balance: TrainingLoadBalance | null): RowData[] {
  if (!balance) return []
  return [{
    date: excelDate(balance.date),
    feedback: balance.feedback ?? null,
    low_aerobic_load: balance.aerobicLow ?? null,
    low_aerobic_target_min: balance.aerobicLowMin ?? null,
    low_aerobic_target_max: balance.aerobicLowMax ?? null,
    high_aerobic_load: balance.aerobicHigh ?? null,
    high_aerobic_target_min: balance.aerobicHighMin ?? null,
    high_aerobic_target_max: balance.aerobicHighMax ?? null,
    anaerobic_load: balance.anaerobic ?? null,
    anaerobic_target_min: balance.anaerobicMin ?? null,
    anaerobic_target_max: balance.anaerobicMax ?? null,
  }]
}

const columns = (...keys: Array<string | ColumnDefinition>): ColumnDefinition[] => keys.map((column) =>
  typeof column === 'string' ? { key: column } : column
)

export function buildTrainingWorkbook(data: TrainingWorkbookData, generatedAt = new Date()): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Runomics'
  workbook.company = 'Runomics'
  workbook.created = generatedAt
  workbook.modified = generatedAt
  workbook.subject = 'Training data export for coaching and analysis'
  workbook.title = 'Runomics Training Export'

  const athleteHrBounds: HrBounds = {
    maxHr: data.athlete.maxHrBpm ?? DEFAULT_HR_BOUNDS.maxHr,
    restingHr: data.athlete.restingHrBpm ?? DEFAULT_HR_BOUNDS.restingHr,
  }

  addDataSheet(workbook, 'Guide', columns(
    { key: 'section', width: 14 }, { key: 'item', width: 28 }, { key: 'description', width: 80, wrap: true },
  ), guideRows(generatedAt))

  addDataSheet(workbook, 'Athlete', columns(
    'display_name', 'age_years', 'sex', 'height_cm', 'weight_kg', 'bmi', 'resting_hr_bpm', 'max_hr_bpm',
    'lactate_threshold_hr_bpm', 'threshold_pace_sec_per_km', 'vma_kmh', 'vo2max_ml_kg_min',
    'fitness_age_years', 'achievable_fitness_age_years', 'hr_zone_1_upper_bpm', 'hr_zone_2_upper_bpm',
    'hr_zone_3_upper_bpm', 'hr_zone_4_upper_bpm', 'hr_zone_5_upper_bpm', 'device_name',
    { key: 'device_since', ...DATE_COLUMN }, { key: 'last_profile_update', ...DATE_COLUMN },
  ), athleteRows(data.athlete))

  addDataSheet(workbook, 'Activities', columns(
    { key: 'activity_id', width: 24 }, { key: 'date', ...DATE_COLUMN }, 'day_of_week', 'iso_week', 'type', 'type_source',
    { key: 'description', width: 28, wrap: true }, 'duration_seconds', 'distance_km', 'pace_sec_per_km',
    'avg_heart_rate_bpm', 'rpe_1_10', 'elevation_gain_m', 'aerobic_training_effect', 'anaerobic_training_effect',
    'trimp', 'calories_kcal', 'cadence_spm', 'ground_contact_ms', 'vertical_oscillation_mm', 'vertical_ratio_pct',
    'stride_length_m', 'vo2max', 'watch_temperature_c', 'hr_zone_1_seconds', 'hr_zone_2_seconds',
    'hr_zone_3_seconds', 'hr_zone_4_seconds', 'hr_zone_5_seconds', 'hard_minutes_z4_z5',
    'weather_temperature_c', 'weather_apparent_temperature_c', 'weather_humidity_pct', 'weather_wind_kph',
    'weather_wind_direction_deg', 'weather_precipitation_mm', 'weather_code_wmo', { key: 'gear_id', width: 22 },
    'shoe_brand', 'shoe_model', 'best_effort_1k_seconds', 'best_effort_1_mile_seconds', 'best_effort_5k_seconds',
    'best_effort_10k_seconds', 'best_effort_half_marathon_seconds', 'best_effort_marathon_seconds',
    'aerobic_decoupling_pct', 'aerobic_decoupling_status', 'execution_kind', 'execution_reps',
    'execution_fade_sec_per_km', 'execution_spread_sec_per_km', 'execution_hr_drift_bpm',
    { key: 'execution_rep_paces_sec_per_km', width: 22 }, 'execution_rep_avg_pace_sec_per_km',
    'execution_rep_avg_hr_bpm', 'execution_rep_avg_seconds', { key: 'comment', width: 36, wrap: true },
  ), activityRows(data, athleteHrBounds))

  addDataSheet(workbook, 'Intervals', columns(
    { key: 'activity_id', width: 24 }, { key: 'date', ...DATE_COLUMN }, { key: 'description', width: 28, wrap: true },
    'segment_index', 'segment', 'rep_index', 'duration_seconds', 'distance_m', 'pace_sec_per_km', 'avg_heart_rate_bpm',
  ), intervalRows(data))

  addDataSheet(workbook, 'Daily Status', columns(
    { key: 'date', ...DATE_COLUMN }, 'actual_activity_count', 'actual_distance_km', 'actual_duration_seconds',
    'daily_trimp', 'fitness_ctl', 'fatigue_atl', 'form_tsb_start_of_day', 'garmin_training_status',
    { key: 'garmin_feedback', width: 24, wrap: true }, 'garmin_fitness_trend', 'garmin_acute_load',
    'garmin_chronic_load', 'garmin_acwr', 'garmin_acwr_status', 'garmin_chronic_load_min',
    'garmin_chronic_load_max', 'planned_workout_count', { key: 'planned_workout_names', width: 32, wrap: true },
    'planned_day_completed', 'training_plan_phase', { key: 'race_names', width: 28, wrap: true },
  ), dailyRows(data, generatedAt, athleteHrBounds))

  addDataSheet(workbook, 'Records', columns(
    'record_key', 'year', 'distance_label', 'distance_km', 'time_seconds', 'pace_sec_per_km',
    { key: 'activity_id', width: 24 }, { key: 'activity_date', ...DATE_COLUMN }, { key: 'event_name', width: 28 },
    'official', 'is_all_time',
  ), recordRows(data))

  addDataSheet(workbook, 'Races', columns(
    'status', { key: 'date', ...DATE_COLUMN }, { key: 'name', width: 30 }, 'distance_label', 'distance_km',
    { key: 'location', width: 24 }, 'target_time_seconds', 'predicted_time_seconds', 'actual_time_seconds',
    { key: 'activity_id', width: 24 },
  ), raceRows(data, generatedAt))

  addDataSheet(workbook, 'Training Plan', columns(
    'plan_id', { key: 'plan_name', width: 28 }, { key: 'plan_start_date', ...DATE_COLUMN },
    { key: 'plan_end_date', ...DATE_COLUMN }, { key: 'workout_date', ...DATE_COLUMN }, 'phase',
    { key: 'workout_name', width: 32 }, 'workout_type', 'planned_distance_m', 'planned_duration_seconds',
    'scheduled_time_of_day', 'estimated_load', 'load_is_estimated', { key: 'steps_json', width: 50, wrap: true },
  ), trainingPlanRows(data))

  addDataSheet(workbook, 'Fitness History', columns(
    { key: 'date', ...DATE_COLUMN }, 'vo2max_ml_kg_min', 'fitness_age_years', 'lactate_threshold_hr_bpm',
    'threshold_pace_sec_per_km', 'weight_kg', { key: 'sources', width: 36 },
  ), fitnessHistoryRows(data))

  addDataSheet(workbook, 'Race Predictions', columns(
    { key: 'date', ...DATE_COLUMN }, 'predicted_5k_seconds', 'predicted_10k_seconds',
    'predicted_half_marathon_seconds', 'predicted_marathon_seconds',
  ), racePredictionRows(data.racePredictions))

  addDataSheet(workbook, 'Shoes', columns(
    { key: 'gear_id', width: 22 }, 'brand', { key: 'model', width: 24 }, { key: 'first_use_date', ...DATE_COLUMN },
    'activity_count', 'total_distance_km', 'max_distance_km', 'remaining_distance_km',
    { key: 'wear_pct', width: 12, numberFormat: '0.0%' }, 'retired',
  ), shoeRows(data))

  addDataSheet(workbook, 'Goals', columns(
    'year', 'annual_distance_goal_km', 'actual_distance_km',
    { key: 'annual_goal_progress_pct', width: 24, numberFormat: '0.0%' }, 'target_distance',
    'target_time_seconds', 'best_time_seconds', 'target_achieved',
  ), goalRows(data))

  addDataSheet(workbook, 'Load Balance', columns(
    { key: 'date', ...DATE_COLUMN }, { key: 'feedback', width: 28, wrap: true }, 'low_aerobic_load',
    'low_aerobic_target_min', 'low_aerobic_target_max', 'high_aerobic_load', 'high_aerobic_target_min',
    'high_aerobic_target_max', 'anaerobic_load', 'anaerobic_target_min', 'anaerobic_target_max',
  ), loadBalanceRows(data.trainingLoadBalance))

  return workbook
}

export async function getTrainingWorkbook(generatedAt = new Date()): Promise<Buffer> {
  const data: TrainingWorkbookData = {
    activities: getAllActivities(),
    athlete: getAthleteProfile(),
    athleteHistory: getAthleteHistory(),
    goals: getGoalYears(),
    pbs: getPbYears(),
    plannedWorkouts: getAllPlannedWorkouts(),
    racePredictions: getRacePredictionDays(),
    shoes: getShoeRecords(),
    thresholdHistory: getThresholdSamples(),
    trainingLoadBalance: getTrainingLoadBalance(),
    trainingPlan: getTrainingPlan(),
    trainingStatus: getTrainingStatusDays(),
    upcomingRaces: getUpcomingRaceYears(),
    vo2maxHistory: getVo2maxSamples(),
  }
  const workbook = buildTrainingWorkbook(data, generatedAt)
  return Buffer.from(await workbook.xlsx.writeBuffer())
}
