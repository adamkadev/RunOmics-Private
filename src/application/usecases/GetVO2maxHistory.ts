import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'

export interface VO2maxPoint {
  date: string
  label: string
  value: number
}

export function getVO2maxHistory(): VO2maxPoint[] {
  const activities = getAllActivities()

  return activities
    .filter((a) => a.vo2maxGarmin !== null && a.vo2maxGarmin !== undefined)
    .map((a) => ({
      date: a.date,
      label: new Date(a.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      value: a.vo2maxGarmin as number,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
