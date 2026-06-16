export type ActivityType =
  | 'Sprint'
  | 'Anaerobic'
  | 'VO2Max'
  | 'Threshold'
  | 'Tempo'
  | 'Base'
  | 'Race'

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
  paceSamples: number[] | null
  vo2maxGarmin: number | null
  avgTemperature: number | null
  cadenceSamples: number[] | null
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
  activities: Activity[]
}

export interface DashboardData {
  currentWeek: WeekSummary
  lastWeek: Pick<WeekSummary, 'totalDistanceKm' | 'sessionCount'>
  weeklyVolume: WeeklyVolume[]
  typeDistribution: TypeDistribution[]
  recentActivities: Activity[]
  currentStreak: number
  longestStreak: number
}

// Visual styling per activity type. Human-readable labels live in i18n
// (`t.activityTypes`); only colors / badge classes belong here.
export const ACTIVITY_TYPE_CONFIG: Record<
  ActivityType,
  { badgeClass: string; chartColor: string }
> = {
  Sprint: {
    badgeClass: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
    chartColor: '#d946ef',
  },

  Anaerobic: {
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    chartColor: '#8E24AA',
  },

  VO2Max: {
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    chartColor: '#E53935',
  },

  Threshold: {
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    chartColor: '#FB8C00',
  },

  Tempo: {
    badgeClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    chartColor: '#FDD835',
  },

  Base: {
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    chartColor: '#4CAF50',
  },

  Race: {
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    chartColor: '#f59e0b',
  },
}