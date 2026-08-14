import { Zap, Flame, Wind, TrendingUp, Clock, Footprints, Flag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HUE } from '@/lib/palette'

export type ActivityType =
  | 'Sprint'
  | 'Anaerobic'
  | 'VO2Max'
  | 'Threshold'
  | 'Tempo'
  | 'Base'
  | 'Race'

export interface SplitLap {
  durationSec: number
  distanceM: number
  avgSpeedMs: number
  avgHr: number | null
}

export interface ActivitySplit {
  type: 'interval_warmup' | 'interval_active' | 'interval_rest' | 'interval_recovery' | 'interval_cooldown'
  durationSec: number
  distanceM: number
  avgSpeedMs: number
  avgHr: number | null
  laps: SplitLap[]
}

/**
 * Conditions at the middle of the run, from Open-Meteo (see
 * scripts/processing/weather.py). Distinct from `avgTemperature`, which is what
 * the watch's own sensor read on the wrist.
 */
export interface ActivityWeather {
  tempC: number
  apparentTempC: number
  humidityPct: number
  windKph: number
  /** Direction the wind blows FROM, in degrees clockwise from north. */
  windDirDeg: number
  precipitationMm: number
  /** WMO weather code - map it with `weatherCondition()`. */
  code: number
}

export interface HrZone {
  zone: number
  seconds: number
  percent: number
  minBpm: number
  maxBpm: number | null  // null for zone 5 (no upper bound)
}

export interface Activity {
  id: string
  week: number
  date: string
  dayOfWeek: string
  type: ActivityType
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
  splits: ActivitySplit[] | null
  paceSamples: number[] | null
  vo2maxGarmin: number | null
  avgTemperature: number | null
  cadenceSamples: number[] | null
  gearId: string | null
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
  | 'rpe'
  | 'hrZones'
  | 'week'
  | 'elevationGain'
>

export type WorkoutStepKind = 'warmup' | 'effort' | 'recovery' | 'cooldown'

export interface WorkoutStep {
  kind: WorkoutStepKind
  minutes: number
  /** Repetition index for interval steps (1-based), for "2 × 10'" style labels. */
  rep?: number
  /** Real target pace range [fast, slow] in sec/km, from Garmin's pace.zone target - see sync_workouts.py. */
  paceSecPerKm?: [number, number]
}

export type ScheduledTimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night'

export interface PlannedWorkout {
  date: string
  name: string
  type?: ActivityType
  distanceM?: number
  durationSecs?: number
  /** Coarse time-of-day only (see scripts/sync_workouts.py) - the exact scheduled
   * minute of a future run is never persisted or served. */
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

// Visual styling per activity type. Human-readable labels live in i18n
// (`t.activityTypes`); only colors / badge classes belong here.
// `chartColor` is the canonical "type" color: used both for charts and for the
// "type = pastille" dots/badges (liquid glass design) - one color per type.
export const ACTIVITY_TYPE_CONFIG: Record<
  ActivityType,
  { badgeClass: string; chartColor: string }
> = {
  Sprint: {
    badgeClass: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
    chartColor: HUE.fuchsia500,
  },

  Anaerobic: {
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    chartColor: HUE.violet600,
  },

  VO2Max: {
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    chartColor: HUE.red500,
  },

  Threshold: {
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    chartColor: HUE.orange500,
  },

  Tempo: {
    badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    chartColor: HUE.yellow500,
  },

  Base: {
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    chartColor: HUE.green500,
  },

  Race: {
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    chartColor: HUE.amber500,
  },
}

export const ACTIVITY_TYPE_ICONS: Record<ActivityType, LucideIcon> = {
  Sprint: Zap,
  Anaerobic: Flame,
  VO2Max: Wind,
  Threshold: TrendingUp,
  Tempo: Clock,
  Base: Footprints,
  Race: Flag,
}