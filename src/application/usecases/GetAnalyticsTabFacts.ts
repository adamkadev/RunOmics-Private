import type { AnalyticsPageData, WeeklyTrendPoint } from './GetAnalyticsData'
import type { TrainingStatus } from './GetTrainingStatus'
import type { TrainingLoadData } from './GetTrainingLoad'
import type { LoadRiskPanel } from './GetLoadRiskPanel'
import type { LoadBalanceData } from './GetLoadBalance'
import type { ThresholdHistoryData } from './GetThresholdHistory'
import type { GarminRacePredictionsData } from './GetGarminRacePredictions'
import type { AnalyticsTabId } from '@/domain/ai/analyticsTabInsight'
import { formatClock } from '@/lib/formatters'
import { round } from '@/lib/math'

// How far back a "this is where you are heading" read looks. Short enough that
// a block of training shows through, long enough to survive one bad week.
const TREND_WEEKS = 12

export interface AnalyticsTabInputs {
  data: AnalyticsPageData
  status: TrainingStatus | null
  load: TrainingLoadData | null
  loadRisk: LoadRiskPanel | null
  loadBalance: LoadBalanceData | null
  threshold: ThresholdHistoryData | null
  racePredictions: GarminRacePredictionsData | null
  vo2max: number | null
}

export type AnalyticsTabFacts = Record<AnalyticsTabId, string[]>

type TrendKey = keyof Pick<WeeklyTrendPoint, 'easyPace' | 'ef' | 'easyAvgHr' | 'avgRpe'>

function trend(points: WeeklyTrendPoint[], key: TrendKey): { from: number; to: number; delta: number } | null {
  const values = points.slice(-TREND_WEEKS).map((p) => p[key]).filter((v): v is number => v !== null)
  const from = values[0]
  const to = values.at(-1)
  if (from === undefined || to === undefined || values.length < 3) return null
  return { from, to, delta: round(to - from, 2) }
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

function fitnessFacts({ status, load, loadRisk, vo2max, threshold }: AnalyticsTabInputs): string[] {
  return [
    load ? `Fitness (CTL) ${Math.round(load.ctl)}, fatigue (ATL) ${Math.round(load.atl)}, form (TSB) ${Math.round(load.tsbNow)}` : null,
    status ? `Training status: ${status.status}, load trend ${status.loadTrend}, injury risk ${status.risk}` : null,
    status ? `Fitness moved ${signed(Math.round(status.ctlDelta))} over the last 2 weeks, fatigue ${signed(Math.round(status.atlDelta))} over 7 days` : null,
    loadRisk?.acwr !== null && loadRisk?.acwr !== undefined
      ? `Acute:chronic load ratio ${loadRisk.acwr.toFixed(2)} (${loadRisk.acwrZone ?? 'unrated'}), safe band 0.8-1.3`
      : null,
    vo2max !== null ? `VO2max ${vo2max}` : null,
    threshold?.latestPace ? `Threshold pace ${formatClock(threshold.latestPace)}/km` : null,
  ].filter((line): line is string => line !== null)
}

function performanceFacts({ data, threshold, racePredictions }: AnalyticsTabInputs): string[] {
  const easy = trend(data.weeklyTrends, 'easyPace')
  const ef = trend(data.weeklyTrends, 'ef')
  const predictions = Object.entries(racePredictions?.latest ?? {})

  return [
    easy
      ? `Easy pace over ${TREND_WEEKS} weeks: ${formatClock(easy.from)}/km to ${formatClock(easy.to)}/km (${signed(Math.round(easy.delta))}s/km)`
      : null,
    ef ? `Aerobic efficiency over ${TREND_WEEKS} weeks: ${ef.from} to ${ef.to} m/min per bpm` : null,
    threshold?.paceGainSec ? `Threshold pace ${Math.abs(threshold.paceGainSec)}s/km ${threshold.paceGainSec > 0 ? 'faster' : 'slower'} across the stored history` : null,
    predictions.length
      ? `Predicted finish times: ${predictions.map(([key, seconds]) => `${key} ${formatClock(seconds)}`).join(', ')}`
      : null,
  ].filter((line): line is string => line !== null)
}

function volumeFacts({ data }: AnalyticsTabInputs): string[] {
  const [year, previousYear] = data.years
  const current = year !== undefined ? data.byYear[year] : undefined
  const previous = previousYear !== undefined ? data.byYear[previousYear] : undefined
  const longest = current ? Math.max(0, ...current.longRuns.map((m) => m.longestKm)) : 0

  return [
    current ? `${year}: ${Math.round(current.totals.distanceKm)} km over ${current.totals.sessionCount} sessions, ${current.totals.avgKmPerWeek} km a week` : null,
    previous ? `${previousYear} for comparison: ${Math.round(previous.totals.distanceKm)} km over ${previous.totals.sessionCount} sessions` : null,
    longest > 0 ? `Longest run this year: ${Math.round(longest)} km` : null,
    current ? `Elevation this year: ${Math.round(current.totals.elevationM)} m` : null,
    `All time: ${Math.round(data.allTime.totals.distanceKm)} km over ${data.allTime.totals.sessionCount} sessions`,
  ].filter((line): line is string => line !== null)
}

function healthFacts({ data, loadRisk, loadBalance }: AnalyticsTabInputs): string[] {
  const easyPct = data.allTime.easyHardSplit.map((m) => m.easyPct).filter((p): p is number => p !== null).at(-1)
  const rpe = trend(data.weeklyTrends, 'avgRpe')
  const easyHr = trend(data.weeklyTrends, 'easyAvgHr')

  return [
    easyPct !== undefined ? `Latest month easy/hard split: ${Math.round(easyPct)}% easy, target around 80%` : null,
    loadRisk?.monotony ? `Training monotony ${loadRisk.monotony.toFixed(1)} (${loadRisk.monotonyZone ?? 'unrated'}), alert above 2.0` : null,
    loadBalance?.feedback ? `Garmin load balance verdict: ${loadBalance.feedback}` : null,
    rpe ? `Perceived effort over ${TREND_WEEKS} weeks: ${rpe.from} to ${rpe.to} out of 10` : null,
    easyHr ? `Easy-run heart rate over ${TREND_WEEKS} weeks: ${Math.round(easyHr.from)} to ${Math.round(easyHr.to)} bpm` : null,
  ].filter((line): line is string => line !== null)
}

/**
 * The reads behind each analytics tab, as plain lines the model can be asked to
 * tie together. Tab-scoped rather than chart-scoped on purpose: one paragraph
 * per theme is four cached documents, where one per chart and window would be
 * dozens regenerated on every sync.
 */
export function analyticsTabFacts(inputs: AnalyticsTabInputs): AnalyticsTabFacts {
  return {
    fitness: fitnessFacts(inputs),
    performance: performanceFacts(inputs),
    volume: volumeFacts(inputs),
    health: healthFacts(inputs),
  }
}
