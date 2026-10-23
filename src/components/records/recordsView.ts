import type { Milestone } from '@/application/usecases/GetMilestones'
import type { RecurringRoute, RouteRun } from '@/application/usecases/GetRecurringRoutes'
import { formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'

export const RECORD_TABS = ['best', 'milestones', 'routes'] as const
export type RecordTab = (typeof RECORD_TABS)[number]

export function parseRecordTab(value: string | null): RecordTab {
  return RECORD_TABS.find((tab) => tab === value) ?? 'best'
}

export const EFFORT_LIST_MAX = 20

export const EFFORT_LIST_FIRST = 5

export function formatGap(seconds: number): string {
  const s = Math.round(Math.abs(seconds))
  return s < 60 ? t.records.gapSeconds(s) : formatDuration(s)
}

export type PredictionGap =
  | { kind: 'faster'; text: string }
  | { kind: 'at'; text: string }
  | { kind: 'slower'; text: string }

/** `at`: Garmin's predictor and the Riegel fallback can land on the best to the second. */
export function predictionGap(bestSeconds: number, predictedSeconds: number): PredictionGap {
  const gap = Math.round(bestSeconds) - Math.round(predictedSeconds)
  if (gap === 0) return { kind: 'at', text: t.records.atPotential }
  return gap > 0
    ? { kind: 'faster', text: t.records.faster(formatGap(gap)) }
    : { kind: 'slower', text: t.records.slower(formatGap(gap)) }
}

export function effortGap(seconds: number, bestSeconds: number): string | null {
  const gap = Math.round(seconds) - Math.round(bestSeconds)
  return gap > 0 ? `+${formatGap(gap)}` : null
}

export function allEffortsLabel(distance: string, count: number): string {
  return count >= EFFORT_LIST_MAX ? t.records.topEfforts(EFFORT_LIST_MAX, distance) : t.records.allEfforts(distance)
}

export interface MilestoneMonth {
  /** yyyy-mm */
  key: string
  items: Milestone[]
}

/** Keeps the input order: milestones arrive newest first. */
export function groupMilestonesByMonth(milestones: Milestone[]): MilestoneMonth[] {
  const groups = new Map<string, Milestone[]>()
  for (const m of milestones) {
    const key = m.date.slice(0, 7)
    const list = groups.get(key)
    if (list) list.push(m)
    else groups.set(key, [m])
  }
  return [...groups.entries()].map(([key, items]) => ({ key, items }))
}

export const TRAIL_RUNS = 6

/** Percent of the trail's height: the slowest run at BAR_MIN, the fastest full. */
const BAR_MIN = 30
const BAR_RANGE = 70

export type TrailTone = 'best' | 'latest' | 'other'

export interface TrailBar {
  activityId: string
  heightPct: number
  tone: TrailTone
}

/** When the latest run is the best, the best's accent wins. */
export function trailBars(route: RecurringRoute): TrailBar[] {
  const runs = route.runs.slice(-TRAIL_RUNS)
  const paces = runs.map((r) => r.paceSecPerKm)
  const fastest = Math.min(...paces)
  const span = Math.max(...paces) - fastest || 1
  return runs.map((run, i) => ({
    activityId: run.activityId,
    heightPct: Math.round(BAR_MIN + ((span - (run.paceSecPerKm - fastest)) / span) * BAR_RANGE),
    tone: run.activityId === route.bestActivityId ? 'best' : i === runs.length - 1 ? 'latest' : 'other',
  }))
}

export type RouteLatest =
  | { kind: 'new-best'; date: string }
  | { kind: 'behind'; run: RouteRun; gapSeconds: number }

export function routeLatest(route: RecurringRoute): RouteLatest | null {
  const latest = route.runs[route.runs.length - 1]
  if (!latest) return null
  if (latest.activityId === route.bestActivityId) return { kind: 'new-best', date: latest.date }
  return { kind: 'behind', run: latest, gapSeconds: latest.paceSecPerKm - route.bestPaceSecPerKm }
}
