import type { Activity, ActivitySplit } from '@/domain/activity/types'
import { DAY_MS, addDays, isoDate, startOfWeek } from '@/lib/calendarDate'

// A shorter stop resumes where it left off: nothing to count "since the return" from.
export const MIN_RETURN_BREAK_DAYS = 28

const RUNNING_SPLITS: ReadonlySet<ActivitySplit['type']> = new Set(['lap', 'interval_active'])

type RunTime = Pick<Activity, 'splits' | 'durationSeconds' | 'longestContinuousRunSec' | 'longestContinuousRunM' | 'runningSec'>

export interface RunningTime {
  longestSec: number
  longestM: number
  runningSec: number
}

/** The sync's reading of cadence or speed, else the splits: a run that has neither says nothing. */
export function runningTime(run: RunTime): RunningTime | null {
  if (run.longestContinuousRunSec != null) {
    return {
      longestSec: run.longestContinuousRunSec,
      longestM: run.longestContinuousRunM ?? 0,
      runningSec: run.runningSec ?? run.durationSeconds,
    }
  }
  if (!run.splits?.length) return null
  let longest = { sec: 0, m: 0 }
  let current = { sec: 0, m: 0 }
  let runningSec = 0
  for (const split of run.splits) {
    current = RUNNING_SPLITS.has(split.type) ? { sec: current.sec + split.durationSec, m: current.m + split.distanceM } : { sec: 0, m: 0 }
    if (RUNNING_SPLITS.has(split.type)) runningSec += split.durationSec
    if (current.sec > longest.sec) longest = current
  }
  return { longestSec: longest.sec, longestM: longest.m, runningSec }
}

export const longestContinuousRunSeconds = (run: RunTime): number => runningTime(run)?.longestSec ?? 0

interface Break {
  start: string
  end: string
}

const breakDays = (pause: Break) => Math.round((Date.parse(pause.end) - Date.parse(pause.start)) / DAY_MS) + 1

export function latestReturnBreak<T extends Break>(breaks: readonly T[] | undefined, minDays = MIN_RETURN_BREAK_DAYS): T | null {
  return [...(breaks ?? [])].filter((pause) => breakDays(pause) >= minDays).sort((a, b) => b.end.localeCompare(a.end))[0] ?? null
}

export const RETURN_MILESTONES = ['continuous10', 'continuous20', 'continuous30', 'nonstop3k', 'nonstop5k', 'blockCompleted'] as const
export type ReturnMilestoneKey = (typeof RETURN_MILESTONES)[number]

export interface ReturnMilestone {
  key: ReturnMilestoneKey
  date: string
  activityId: string | null
}

const RUN_MILESTONES: { key: ReturnMilestoneKey; reached: (time: RunningTime) => boolean }[] = [
  { key: 'continuous10', reached: (time) => time.longestSec >= 10 * 60 },
  { key: 'continuous20', reached: (time) => time.longestSec >= 20 * 60 },
  { key: 'continuous30', reached: (time) => time.longestSec >= 30 * 60 },
  { key: 'nonstop3k', reached: (time) => time.longestM >= 3000 },
  { key: 'nonstop5k', reached: (time) => time.longestM >= 5000 },
]

type ReturnRun = Pick<Activity, 'id' | 'date'> & RunTime

/** Each milestone's first run after the break; `blockCompleted` is the day the first block begun after it was completed. */
export function returnMilestones(
  runs: readonly ReturnRun[],
  breakEnd: string,
  blockCompletedOn: string | null = null,
): ReturnMilestone[] {
  const since = runs.filter((run) => run.date.slice(0, 10) > breakEnd).sort((a, b) => a.date.localeCompare(b.date))
  const milestones: ReturnMilestone[] = []
  for (const { key, reached } of RUN_MILESTONES) {
    const first = since.find((run) => {
      const time = runningTime(run)
      return time !== null && reached(time)
    })
    if (first) milestones.push({ key, date: first.date.slice(0, 10), activityId: first.id })
  }
  if (blockCompletedOn && blockCompletedOn > breakEnd) milestones.push({ key: 'blockCompleted', date: blockCompletedOn, activityId: null })
  return milestones.sort((a, b) => a.date.localeCompare(b.date) || RETURN_MILESTONES.indexOf(a.key) - RETURN_MILESTONES.indexOf(b.key))
}

export interface ReturnWeek {
  /** The Monday. */
  weekStart: string
  runningSec: number
  longestSec: number
}

/** Every week from the return to today's, empty ones included: a missed week is part of the story. */
export function returnWeeks(runs: readonly ReturnRun[], breakEnd: string, today: string): ReturnWeek[] {
  const firstMonday = startOfWeek(addDays(new Date(`${breakEnd}T00:00:00`), 1))
  const lastMonday = isoDate(startOfWeek(new Date(`${today}T00:00:00`)))
  const weeks: ReturnWeek[] = []
  for (let monday = firstMonday; isoDate(monday) <= lastMonday; monday = addDays(monday, 7)) {
    const start = isoDate(monday)
    const end = isoDate(addDays(monday, 6))
    const inWeek = runs.filter((run) => run.date.slice(0, 10) > breakEnd && run.date.slice(0, 10) >= start && run.date.slice(0, 10) <= end)
    const times = inWeek.map((run) => runningTime(run) ?? { longestSec: 0, longestM: 0, runningSec: run.durationSeconds })
    weeks.push({
      weekStart: start,
      runningSec: times.reduce((sum, time) => sum + time.runningSec, 0),
      longestSec: Math.max(0, ...times.map((time) => time.longestSec)),
    })
  }
  return weeks
}
