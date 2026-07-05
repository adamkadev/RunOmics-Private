import { t } from '@/i18n'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'

export interface VO2maxPoint {
  date: string
  label: string
  value: number
}

export type VO2maxTrend = 'up' | 'down' | 'stable'

export function getLatestVO2max(): number | null {
  const activities = getAllActivities()
  const latest = activities.find((a) => a.vo2maxGarmin !== null && a.vo2maxGarmin !== undefined)
  return latest?.vo2maxGarmin ?? null
}

export function getVO2maxTrend(): VO2maxTrend | null {
  const history = getVO2maxHistory()
  const latest = history[history.length - 1]
  const previous = history[history.length - 2]
  if (!latest || !previous) return null
  const delta = latest.value - previous.value
  if (delta > 0.4) return 'up'
  if (delta < -0.4) return 'down'
  return 'stable'
}

// Returns one data point per week (last activity of the week) for the last 12 weeks.
export function getVO2maxHistory(): VO2maxPoint[] {
  const activities = getAllActivities()
    .filter((a) => a.vo2maxGarmin !== null && a.vo2maxGarmin !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Deduplicate: keep last reading per ISO week (YYYY-Www)
  const byWeek = new Map<string, { date: string; value: number }>()
  for (const a of activities) {
    const d = new Date(a.date + 'T00:00:00')
    const jan4 = new Date(d.getFullYear(), 0, 4)
    const weekNum = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7)
    const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
    byWeek.set(key, { date: a.date, value: a.vo2maxGarmin as number })
  }

  const weeks = [...byWeek.values()].sort((a, b) => a.date.localeCompare(b.date))

  return weeks.map(({ date, value }) => ({
    date,
    label: new Date(date + 'T00:00:00').toLocaleDateString(t.locale, { month: 'short', day: 'numeric' }),
    value,
  }))
}
