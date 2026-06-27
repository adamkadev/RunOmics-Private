import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { Activity } from '@/domain/activity/types'

const CSV_COLUMNS: { key: keyof Activity; header: string }[] = [
  { key: 'date', header: 'date' },
  { key: 'dayOfWeek', header: 'dayOfWeek' },
  { key: 'type', header: 'type' },
  { key: 'description', header: 'description' },
  { key: 'durationSeconds', header: 'durationSeconds' },
  { key: 'distanceKm', header: 'distanceKm' },
  { key: 'paceSecPerKm', header: 'paceSecPerKm' },
  { key: 'avgHeartRate', header: 'avgHeartRate' },
  { key: 'rpe', header: 'rpe' },
  { key: 'elevationGain', header: 'elevationGain' },
  { key: 'aerTrainingEffect', header: 'aerTrainingEffect' },
  { key: 'anaTrainingEffect', header: 'anaTrainingEffect' },
  { key: 'calories', header: 'calories' },
  { key: 'cadenceSpm', header: 'cadenceSpm' },
  { key: 'groundContactMs', header: 'groundContactMs' },
  { key: 'verticalOscillationMm', header: 'verticalOscillationMm' },
  { key: 'verticalRatioPct', header: 'verticalRatioPct' },
  { key: 'strideLengthM', header: 'strideLengthM' },
  { key: 'vo2maxGarmin', header: 'vo2maxGarmin' },
  { key: 'avgTemperature', header: 'avgTemperature' },
  { key: 'comment', header: 'comment' },
]

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

// Builds the CSV server-side from the already-cached repository data, instead
// of shipping the full per-activity JSON (hrSamples, polyline, splits, etc.)
// to the browser just to discard everything but these ~20 scalar columns.
export function getActivitiesCsv(): string {
  const activities = getAllActivities()
  const header = CSV_COLUMNS.map((c) => c.header).join(',')
  const rows = activities.map((a) => CSV_COLUMNS.map((c) => csvEscape(a[c.key])).join(','))
  return [header, ...rows].join('\n')
}
