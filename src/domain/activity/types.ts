/**
 * Hardest effort first. The order is a contract: the filter chips break ties in it,
 * /api/activities accepts exactly these, and the type style map is declared in it.
 */
export const ACTIVITY_TYPES = ['Sprint', 'Anaerobic', 'VO2Max', 'Threshold', 'Tempo', 'Base', 'Race'] as const

export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export function isActivityType(value: unknown): value is ActivityType {
  return typeof value === 'string' && (ACTIVITY_TYPES as readonly string[]).includes(value)
}

export interface SplitLap {
  durationSec: number
  distanceM: number
  avgSpeedMs: number
  avgHr: number | null
}

export interface ActivitySplit {
  type: 'interval_warmup' | 'interval_active' | 'interval_rest' | 'interval_recovery' | 'interval_cooldown' | 'lap'
  durationSec: number
  distanceM: number
  avgSpeedMs: number
  avgHr: number | null
  laps: SplitLap[]
}

export interface ActivityWeather {
  tempC: number
  apparentTempC: number
  humidityPct: number
  windKph: number
  windDirDeg: number
  precipitationMm: number
  code: number
}

export interface HrZone {
  zone: number
  seconds: number
  percent: number
  minBpm: number
  maxBpm: number | null
}

export interface Activity {
  sport?: string
  id: string
  week: number
  date: string
  dayOfWeek: string
  /** Local wall-clock start, `YYYY-MM-DDTHH:MM:SS`; absent on runs synced before it was stored. */
  startTimeLocal?: string
  type: ActivityType
  typeSource?: 'garmin' | 'runomics'
  description: string
  durationSeconds: number
  distanceKm: number
  paceSecPerKm: number | null
  hrZones: HrZone[]
  avgHeartRate: number | null
  rpe: number | null
  comment: string
  polyline: string | null
  route: [number, number][] | null
  elevationGain: number | null
  aerTrainingEffect: number | null
  anaTrainingEffect: number | null
  hrSamples: number[] | null
  elevationProfile: number[] | null
  calories: number | null
  cadenceSpm: number | null
  groundContactMs: number | null
  verticalOscillationMm: number | null
  verticalRatioPct: number | null
  strideLengthM: number | null
  bestEfforts: Record<string, number> | null
  /** Most metres covered in each duration, keyed by its seconds on the moving clock; absent until a reprocess. */
  durationBests?: Record<string, number> | null
  splits: ActivitySplit[] | null
  paceSamples: number[] | null
  /** Minetti's grade-adjusted pace; null without a barometric altitude, absent until a reprocess. */
  gapSecPerKm?: number | null
  /** Grade-adjusted pace sampled at the same points as paceSamples, in whole seconds. */
  gapSamples?: number[] | null
  vo2maxGarmin: number | null
  avgTemperature: number | null
  cadenceSamples: number[] | null
  gearId: string | null
  gearPending?: true
  weather: ActivityWeather | null
}

export type ActivitySummary = Pick<
  Activity,
  | 'id'
  | 'date'
  | 'dayOfWeek'
  | 'type'
  | 'description'
  | 'comment'
  | 'distanceKm'
  | 'durationSeconds'
  | 'paceSecPerKm'
  | 'avgHeartRate'
> & {
  /** Whole seconds in heart-rate zones 1 to 5, in order: the list reads only its easy share. */
  zones: number[]
  /** For the list's shoe filter, which runs on the phone. */
  gearId?: string | null
  /** From encodeRouteThumb; null for a treadmill run. */
  routeThumb?: string | null
}

export type WorkoutStepKind = 'warmup' | 'effort' | 'recovery' | 'cooldown'

export interface WorkoutStep {
  kind: WorkoutStepKind
  minutes: number
  /** The exact length, where the plan gives one: a 20 s stride is not "1'". */
  seconds?: number
  rep?: number
  paceSecPerKm?: [number, number]
}

export type ScheduledTimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night'

export interface PlannedWorkout {
  date: string
  name: string
  type?: ActivityType
  distanceM?: number
  durationSecs?: number
  scheduledTime?: ScheduledTimeOfDay
  estimatedLoad?: number
  isEstimated?: boolean
  steps?: WorkoutStep[]
}

export interface WeeklyVolume {
  week: number
  year: number
  label: string
  distanceKm: number
  sessionCount: number
}

export interface TypeDistribution {
  type: ActivityType
  count: number
  distanceKm: number
  percent: number
}

export interface WeekSummary {
  weekNumber: number
  totalDistanceKm: number
  totalDurationSeconds: number
  sessionCount: number
  avgHeartRate: number | null
  avgPaceSecPerKm: number | null
}

export interface DashboardData {
  currentWeek: WeekSummary
  lastWeek: Pick<WeekSummary, 'totalDistanceKm' | 'sessionCount'>
  weeks: WeekSummary[]
  weeklyVolume: WeeklyVolume[]
  typeDistribution: TypeDistribution[]
  recentActivities: ActivitySummary[]
  currentStreak: number
  longestStreak: number
}
