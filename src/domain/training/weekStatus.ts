import type { TrainingStatusType } from '@/domain/training/status'

const MIN_RATED_DAYS = 3

export function weekTrainingStatus(
  dates: string[],
  statusByDate: Record<string, TrainingStatusType | undefined>,
): TrainingStatusType | null {
  const counts = new Map<TrainingStatusType, number>()
  let ratedDays = 0
  let last: TrainingStatusType | null = null

  for (const date of dates) {
    const status = statusByDate[date]
    if (!status) continue
    counts.set(status, (counts.get(status) ?? 0) + 1)
    ratedDays += 1
    last = status
  }

  if (last === null || ratedDays < MIN_RATED_DAYS) return null

  let winner = last
  let winnerDays = counts.get(last) ?? 0
  for (const [status, days] of counts) {
    if (days > winnerDays) {
      winner = status
      winnerDays = days
    }
  }

  return winner
}
