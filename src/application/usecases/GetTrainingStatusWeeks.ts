import { getTrainingStatusDays } from '@/infrastructure/repositories/JsonTrainingStatusRepository'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { garminStatusType, type TrainingStatusType } from './GetTrainingStatus'

const WEEKS = 4

export interface TrainingStatusWeek {
  weekStart: string
  weekEnd: string
  status: TrainingStatusType | null
}

export function getTrainingStatusWeeks(weeks: number = WEEKS): TrainingStatusWeek[] {
  const days = getTrainingStatusDays()
  if (days.length === 0) return []

  const byDate = new Map(days.map((day) => [day.date, garminStatusType(day.status)]))
  const lastDay = days[days.length - 1]
  if (!lastDay) return []

  const currentMonday = startOfWeek(new Date(lastDay.date + 'T00:00:00'))

  const result: TrainingStatusWeek[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(currentMonday, -i * 7)
    const weekEnd = addDays(weekStart, 6)

    const counts = new Map<TrainingStatusType, number>()
    for (let d = weekStart; d <= weekEnd; d = addDays(d, 1)) {
      const status = byDate.get(isoDate(d))
      if (status) counts.set(status, (counts.get(status) ?? 0) + 1)
    }
    const dominant = Array.from(counts.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null

    result.push({ weekStart: isoDate(weekStart), weekEnd: isoDate(weekEnd), status: dominant })
  }
  return result
}
