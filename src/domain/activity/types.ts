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

/**
 * One ramp, five hue families instead of seven: green for the aerobic base,
 * then amber, orange and red as the effort rises. Violet and fuchsia are off
 * the table on purpose - `violet600` is the literal `--accent-text` of the
 * endurance theme, so a type painted in either would read as the selection
 * accent on that theme (this happened once already: Anaerobic used to be
 * violet600).
 *
 * Tempo is `amber400` rather than a mid yellow - the app's dark, green-tinted
 * background desaturates a plain yellow toward olive/mustard, the least
 * legible step in the ramp.
 *
 * The red family holds the three types EFFORT_ZONE_BY_TYPE puts in Z5, at
 * three depths that stay bright enough to read as "hard" rather than
 * "disabled" against that same dark background: `red600` for Sprint, `red500`
 * for Anaerobic, and `roRed` - the lightest - for VO2Max, which is also the
 * `--zone-5` token itself, so a VO2Max dot and a zone-5 segment agree rather
 * than competing. Declared hardest first, so the object reads top to bottom
 * as the ramp.
 *
 * `green600` is a shade cooler and darker than the accent/selection green
 * (both used to be `green500`, which read a Base dot as a selection
 * marker). Race sits outside the ramp entirely, in blue: it's an event, not
 * an intensity, and amber is already spoken for elsewhere as "nearest race
 * countdown" on the Plan screen - the collision that rule guards against is
 * Race painting itself amber, not Tempo.
 */
export const ACTIVITY_TYPE_CONFIG: Record<ActivityType, { chartColor: string }> = {
  Sprint:    { chartColor: HUE.red600 },
  Anaerobic: { chartColor: HUE.red500 },
  VO2Max:    { chartColor: HUE.roRed },
  Threshold: { chartColor: HUE.orange500 },
  Tempo:     { chartColor: HUE.amber400 },
  Base:      { chartColor: HUE.green600 },
  Race:      { chartColor: HUE.blue300 },
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
