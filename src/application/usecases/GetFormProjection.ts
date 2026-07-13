import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getAthleteProfile } from '@/infrastructure/repositories/JsonAthleteRepository'
import { buildTimeSeries, type HrBounds } from './GetTrainingLoad'
import { getPlannedWorkouts } from './GetPlannedWorkouts'
import { getNextRace } from './GetNextRace'
import { addDays, isoDate } from '@/lib/calendarDate'
import { round } from '@/lib/math'

const DEFAULT_HORIZON_DAYS = 14
const MAX_RACE_HORIZON_DAYS = 90
const HISTORY_DAYS = 14
const CTL_DAYS = 42
const ATL_DAYS = 7
// Mirrors GetPlannedWorkouts' own acknowledged estimate error - the projection
// is run once at 80% and once at 120% of estimated load to bound the result.
const LOAD_UNCERTAINTY = 0.2

export type ProjectionVerdict = 'on-track' | 'ease-off' | 'peak-ready' | 'build-more'

export interface ProjectionPoint {
  date: string
  tsb: number
  /** Only set for projected points - the +/-20% load-estimate uncertainty band. */
  tsbLow?: number
  tsbHigh?: number
  isProjected: boolean
}

export interface FormProjection {
  points: ProjectionPoint[]
  horizonDays: number
  isRaceTarget: boolean
  raceName?: string
  projectedTsb: number
  projectedTsbLow: number
  projectedTsbHigh: number
  verdict: ProjectionVerdict
}

export function classifyProjectionVerdict(tsb: number, daysUntil: number): ProjectionVerdict {
  if (tsb > 20 && daysUntil > 10) return 'build-more'
  if (tsb >= 5) return 'peak-ready'
  if (tsb < 0) return 'ease-off'
  return 'on-track'
}

/** Rolls CTL/ATL forward day by day from `startDate`, applying `plannedLoadByDate` (default 0). */
export function projectTsbSeries(
  startCtl: number,
  startAtl: number,
  startDate: Date,
  horizonDays: number,
  plannedLoadByDate: Map<string, number>,
  loadMultiplier = 1,
): ProjectionPoint[] {
  let ctl = startCtl
  let atl = startAtl
  const pts: ProjectionPoint[] = []
  for (let i = 1; i <= horizonDays; i++) {
    const date = isoDate(addDays(startDate, i))
    pts.push({ date, tsb: round(ctl - atl), isProjected: true })
    const load = (plannedLoadByDate.get(date) ?? 0) * loadMultiplier
    ctl += (load - ctl) / CTL_DAYS
    atl += (load - atl) / ATL_DAYS
  }
  return pts
}

export async function getFormProjection(): Promise<FormProjection | null> {
  const activities = getAllActivities()
  if (!activities.length) return null

  const athlete = getAthleteProfile()
  const hrBounds: HrBounds | undefined =
    athlete.maxHrBpm && athlete.restingHrBpm
      ? { maxHr: athlete.maxHrBpm, restingHr: athlete.restingHrBpm }
      : undefined

  const series = buildTimeSeries(activities, hrBounds)
  const entries = Array.from(series.entries())
  const lastEntry = entries[entries.length - 1]
  if (!lastEntry) return null
  const [lastDateStr, lastSnap] = lastEntry
  const lastDate = new Date(lastDateStr + 'T00:00:00')

  const nextRace = await getNextRace()
  let horizonDays = DEFAULT_HORIZON_DAYS
  let isRaceTarget = false
  if (nextRace) {
    const raceDate = new Date(nextRace.date + 'T00:00:00')
    const daysAway = Math.round((raceDate.getTime() - lastDate.getTime()) / 86_400_000)
    if (daysAway > 0 && daysAway <= MAX_RACE_HORIZON_DAYS) {
      horizonDays = daysAway
      isRaceTarget = true
    }
  }

  const planned = await getPlannedWorkouts()
  const plannedLoadByDate = new Map(planned.map((p) => [p.date, p.estimatedLoad ?? 0]))

  const mid = projectTsbSeries(lastSnap.ctl, lastSnap.atl, lastDate, horizonDays, plannedLoadByDate, 1)
  // less realized load than estimated -> fresher; more realized load -> more fatigued.
  const high = projectTsbSeries(lastSnap.ctl, lastSnap.atl, lastDate, horizonDays, plannedLoadByDate, 1 - LOAD_UNCERTAINTY)
  const low = projectTsbSeries(lastSnap.ctl, lastSnap.atl, lastDate, horizonDays, plannedLoadByDate, 1 + LOAD_UNCERTAINTY)
  const lastMid = mid[mid.length - 1]
  const lastLow = low[low.length - 1]
  const lastHigh = high[high.length - 1]
  if (!lastMid || !lastLow || !lastHigh) return null

  const history: ProjectionPoint[] = entries
    .slice(-(HISTORY_DAYS + 1))
    .map(([date, snap]) => ({ date, tsb: snap.tsb, isProjected: false }))

  const projected: ProjectionPoint[] = mid.map((m, i) => ({
    date: m.date,
    tsb: m.tsb,
    tsbLow: low[i]?.tsb,
    tsbHigh: high[i]?.tsb,
    isProjected: true,
  }))

  return {
    points: [...history, ...projected],
    horizonDays,
    isRaceTarget,
    raceName: nextRace?.name,
    projectedTsb: lastMid.tsb,
    projectedTsbLow: lastLow.tsb,
    projectedTsbHigh: lastHigh.tsb,
    verdict: classifyProjectionVerdict(lastMid.tsb, horizonDays),
  }
}
