import type { Milestone } from '@/application/usecases/GetMilestones'
import type { RecurringRoute, RouteRun } from '@/application/usecases/GetRecurringRoutes'
import { formatDuration } from '@/lib/formatters'
import { t } from '@/i18n'

export const RECORD_TABS = ['best', 'milestones', 'routes'] as const
export type RecordTab = (typeof RECORD_TABS)[number]

/** ?tab= in the address bar; anything else, or nothing, is Best times. */
export function parseRecordTab(value: string | null): RecordTab {
  return RECORD_TABS.find((tab) => tab === value) ?? 'best'
}

/** The longest list a distance's "All efforts" opens to. */
export const EFFORT_LIST_MAX = 20

/** The inset list shows this many before "All efforts" opens the rest. */
export const EFFORT_LIST_FIRST = 5

/**
 * A gap in time, as the mockup writes it: seconds alone under a minute
 * ("5s"), the clock from there ("1:43") - a bare "103s" is a count to do
 * in your head.
 */
export function formatGap(seconds: number): string {
  const s = Math.round(Math.abs(seconds))
  return s < 60 ? t.records.gapSeconds(s) : formatDuration(s)
}

export type PredictionGap =
  | { kind: 'faster'; text: string }
  | { kind: 'at'; text: string }
  | { kind: 'slower'; text: string }

/**
 * What the prediction says about the best: how much faster it is to run
 * now, that the best already is the potential (Garmin's predictor and the
 * Riegel fallback can land on the best to the second), or how far the
 * prediction sits behind it.
 */
export function predictionGap(bestSeconds: number, predictedSeconds: number): PredictionGap {
  const gap = Math.round(bestSeconds) - Math.round(predictedSeconds)
  if (gap === 0) return { kind: 'at', text: t.records.atPotential }
  return gap > 0
    ? { kind: 'faster', text: t.records.faster(formatGap(gap)) }
    : { kind: 'slower', text: t.records.slower(formatGap(gap)) }
}

/** "+3s" behind the distance's best; the best itself has none. */
export function effortGap(seconds: number, bestSeconds: number): string | null {
  const gap = Math.round(seconds) - Math.round(bestSeconds)
  return gap > 0 ? `+${formatGap(gap)}` : null
}

/**
 * The foot of the inset list: "All 1K efforts" when the list holds every
 * one, the honest "Top 20" when it was cut at the cap.
 */
export function allEffortsLabel(distance: string, count: number): string {
  return count >= EFFORT_LIST_MAX ? t.records.topEfforts(EFFORT_LIST_MAX, distance) : t.records.allEfforts(distance)
}

export interface MilestoneMonth {
  /** yyyy-mm */
  key: string
  items: Milestone[]
}

/** Newest month first, as the milestones already arrive. */
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

/** The trail shows the last six runs (Wave 4, App Fixes 1g). */
export const TRAIL_RUNS = 6

/** Bar heights as a share of the 36 px trail: the slowest run at the floor, the fastest full. */
const BAR_MIN = 30
const BAR_RANGE = 70

export type TrailTone = 'best' | 'latest' | 'other'

export interface TrailBar {
  activityId: string
  heightPct: number
  tone: TrailTone
}

/**
 * One bar per run in date order, height for speed. The route's best is the
 * accent and the latest is ink; when the latest is the best, the accent wins
 * - that is the news. A best older than the trail leaves no accent on it.
 */
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

/** The latest run against the route's best: the new best, or how far off it. */
export function routeLatest(route: RecurringRoute): RouteLatest | null {
  const latest = route.runs[route.runs.length - 1]
  if (!latest) return null
  if (latest.activityId === route.bestActivityId) return { kind: 'new-best', date: latest.date }
  return { kind: 'behind', run: latest, gapSeconds: latest.paceSecPerKm - route.bestPaceSecPerKm }
}
