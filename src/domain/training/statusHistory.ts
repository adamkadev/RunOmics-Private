import type { TrainingStatusType } from '@/application/usecases/GetTrainingStatus'

export interface TrainingStatusSegment {
  status: TrainingStatusType
  days: number
  from: string
  to: string
}

export function buildSegments(
  points: Array<{ date: string; status: TrainingStatusType | null }>,
): TrainingStatusSegment[] {
  const segments: TrainingStatusSegment[] = []

  for (const point of points) {
    const status = point.status
    if (!status) continue

    const last = segments[segments.length - 1]
    if (last && last.status === status && isNextDay(last.to, point.date)) {
      last.days += 1
      last.to = point.date
      continue
    }
    segments.push({ status, days: 1, from: point.date, to: point.date })
  }

  return segments
}

function isNextDay(previous: string, current: string): boolean {
  const gap = new Date(current + 'T00:00:00').getTime() - new Date(previous + 'T00:00:00').getTime()
  return gap === 86_400_000
}
