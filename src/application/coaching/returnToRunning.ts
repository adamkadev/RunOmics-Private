import type { Activity, ActivitySplit } from '@/domain/activity/types'
import { DAY_MS } from '@/lib/calendarDate'
import type { TrainingBreak, TrainingBreakReason } from '@/infrastructure/repositories/JsonAthleteRepository'

const GRADUAL_RETURN: readonly TrainingBreakReason[] = ['injury', 'illness', 'pregnancy']
// A shorter stop resumes under the break rule alone, without a run/walk return.
const MIN_BREAK_DAYS = 28
// The end point of the common run/walk programmes; convention, not a tested threshold.
const RETURNED_SECONDS = 30 * 60
const RUNNING: ReadonlySet<ActivitySplit['type']> = new Set(['lap', 'interval_active'])

export interface ReturnToRunning {
  reason: TrainingBreakReason
  breakStart: string
  breakEnd: string
  longestContinuousMinutesSince: number
}

/** From the splits alone: no walking-speed cutoff, since a returning athlete's jog can be as slow as a brisk walk. */
export function longestContinuousRunSeconds(run: Activity): number {
  let longest = 0
  let current = 0
  for (const split of run.splits ?? []) {
    current = RUNNING.has(split.type) ? current + split.durationSec : 0
    longest = Math.max(longest, current)
  }
  return longest
}

const breakDays = (pause: TrainingBreak) => Math.round((Date.parse(pause.end) - Date.parse(pause.start)) / DAY_MS) + 1

export function returnToRunning(breaks: TrainingBreak[] | undefined, runs: Activity[], referenceDate: string): ReturnToRunning | null {
  const pause = (breaks ?? [])
    .filter((candidate) => GRADUAL_RETURN.includes(candidate.reason) && breakDays(candidate) >= MIN_BREAK_DAYS)
    .sort((a, b) => b.end.localeCompare(a.end))[0]
  if (!pause) return null

  const since = runs.filter((run) => run.date.slice(0, 10) > pause.end && run.date.slice(0, 10) <= referenceDate)
  const longest = Math.max(0, ...since.map(longestContinuousRunSeconds))
  if (longest >= RETURNED_SECONDS) return null
  return { reason: pause.reason, breakStart: pause.start, breakEnd: pause.end, longestContinuousMinutesSince: Math.round(longest / 60) }
}
