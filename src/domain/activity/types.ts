import { Zap, Flame, Wind, TrendingUp, Clock, Footprints, Flag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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
}

// Lightweight projection of `Activity` for list views (activities list, search) -
// excludes heavy per-sample arrays (hrSamples, paceSamples, elevationProfile, polyline...)
// that the row UI never reads, so paginated list responses stay small.
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
  // 5 aggregate HR-zone buckets (not per-sample) - kept so list views can
  // derive the easy/hard split from the same source as Today and Plan.
  | 'hrZones'
>

export interface PlannedWorkout {
  date: string
  name: string
  type?: ActivityType
  distanceM?: number
  durationSecs?: number
  scheduledTime?: string
  /** TRIMP estimated from historical load for this type - see GetPlannedWorkouts. */
  estimatedLoad?: number
  isEstimated?: boolean
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
  recentActivities: Activity[]
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
    chartColor: '#d946ef', // fuchsia-500
  },

  Anaerobic: {
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    chartColor: '#7c3aed', // violet-600
  },

  VO2Max: {
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    chartColor: '#ef4444', // red-500
  },

  Threshold: {
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    chartColor: '#f97316', // orange-500
  },

  Tempo: {
    badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    chartColor: '#eab308', // yellow-500
  },

  Base: {
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    chartColor: '#22c55e', // green-500
  },

  Race: {
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    chartColor: '#f59e0b', // amber-500
  },
}

// Icon per activity type, shared by the activity list, calendar (week/planned
// workout) and anywhere else a type needs a glyph - keeps them visually consistent.
export const ACTIVITY_TYPE_ICONS: Record<ActivityType, LucideIcon> = {
  Sprint: Zap,
  Anaerobic: Flame,
  VO2Max: Wind,
  Threshold: TrendingUp,
  Tempo: Clock,
  Base: Footprints,
  Race: Flag,
}