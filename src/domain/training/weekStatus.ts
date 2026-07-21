import type { TrainingStatusType } from '@/application/usecases/GetTrainingStatus'

// Below three rated days the "majority" is one or two watch readings; naming a
// whole week from that would state a verdict Garmin never actually gave.
const MIN_RATED_DAYS = 3

/**
 * Garmin's own verdict on a week, never a computed proxy: the status covering
 * the most of the week's rated days wins, and a tie goes to the one the week
 * ended on, since that is the reading still standing. Days the watch declined
 * to rate (or never saw) are left out. `dates` must be in chronological order.
 */
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
