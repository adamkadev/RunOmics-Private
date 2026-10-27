import type { Activity } from '@/domain/activity/types'
import { DAY_MS } from '@/lib/calendarDate'
import { longestContinuousRunSeconds } from '@/domain/training/returnProgress'
import type { TrainingBreak, TrainingBreakReason } from '@/infrastructure/repositories/JsonAthleteRepository'

const GRADUAL_RETURN: readonly TrainingBreakReason[] = ['injury', 'illness', 'pregnancy']
// A shorter stop resumes under the break rule alone, without a run/walk return.
const MIN_BREAK_DAYS = 28
// The end point of the common run/walk programmes; convention, not a tested threshold.
const RETURNED_SECONDS = 30 * 60

export interface ReturnToRunning {
  reason: TrainingBreakReason
  breakStart: string
  breakEnd: string
  longestContinuousMinutesSince: number
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
