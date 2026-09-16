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

export const ACTIVITY_TYPE_CONFIG: Record<ActivityType, { chartColor: string }> = {
  Sprint:    { chartColor: HUE.fuchsia500 },
  Anaerobic: { chartColor: HUE.violet600 },
  VO2Max:    { chartColor: HUE.red500 },
  Threshold: { chartColor: HUE.orange500 },
  Tempo:     { chartColor: HUE.yellow500 },
  Base:      { chartColor: HUE.green500 },
  Race:      { chartColor: HUE.amber500 },
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
