import { t } from '@/i18n'
import { round } from '@/lib/math'
import type { AnalyticsPageData, MonthlyEfficiency, MonthlyPace } from '@/application/usecases/GetAnalyticsData'
import type { YearComparisonData } from '@/application/usecases/GetYearComparison'

export type SeasonHeadlineTone = 'positive' | 'caution'

export interface SeasonHeadlineBullet {
  tone: SeasonHeadlineTone
  text: string
}

export interface SeasonHeadlineData {
  title: string
  bullets: SeasonHeadlineBullet[]
}

const EFFICIENCY_THRESHOLD = 0.05
const EASY_PACE_THRESHOLD_SEC = 10
const VOLUME_THRESHOLD_PCT = 5

function efficiencyBullet(trend: MonthlyEfficiency[]): SeasonHeadlineBullet | null {
  const known = trend.filter((m): m is MonthlyEfficiency & { ef: number } => m.ef !== null)
  if (known.length < 2) return null
  const diff = round(known[known.length - 1].ef - known[0].ef, 2)
  if (Math.abs(diff) < EFFICIENCY_THRESHOLD) return null
  return { tone: diff > 0 ? 'positive' : 'caution', text: t.analytics.seasonHeadline.efficiency(diff) }
}

function easyPaceBullet(trend: MonthlyPace[]): SeasonHeadlineBullet | null {
  const known = trend.filter((m): m is MonthlyPace & { easyPace: number } => m.easyPace !== null)
  if (known.length < 2) return null
  const diffSec = known[known.length - 1].easyPace - known[0].easyPace // negative = faster
  if (Math.abs(diffSec) < EASY_PACE_THRESHOLD_SEC) return null
  return { tone: diffSec < 0 ? 'positive' : 'caution', text: t.analytics.seasonHeadline.easyPace(diffSec) }
}

function volumeBullet(comparison: YearComparisonData | null, currentYear: number): SeasonHeadlineBullet | null {
  if (!comparison || comparison.years[0] !== currentYear) return null
  const { newer, older } = comparison
  if (older.avgKmPerWeek <= 0) return null
  const pct = Math.round(((newer.avgKmPerWeek - older.avgKmPerWeek) / older.avgKmPerWeek) * 100)
  if (Math.abs(pct) < VOLUME_THRESHOLD_PCT) return null
  return { tone: pct > 0 ? 'positive' : 'caution', text: t.analytics.seasonHeadline.volume(pct, older.year) }
}

function headlineTitle(bullets: SeasonHeadlineBullet[]): string {
  const positive = bullets.filter((b) => b.tone === 'positive').length
  const caution = bullets.length - positive
  if (caution === 0) return t.analytics.seasonHeadline.titlePositive
  if (positive === 0) return t.analytics.seasonHeadline.titleCaution
  return t.analytics.seasonHeadline.titleMixed
}

// Names the 2-3 biggest changes of the current season from data that's already
// computed elsewhere (year trend series + year-over-year comparison) - no new
// aggregation, just a reading over it. Returns null when nothing crosses the
// signal thresholds, so the card stays honest rather than forcing a verdict.
export function getSeasonHeadline(
  data: AnalyticsPageData,
  comparison: YearComparisonData | null,
): SeasonHeadlineData | null {
  const currentYear = data.years[0]
  const season = currentYear !== undefined ? data.byYear[currentYear] : undefined
  if (!season) return null

  const bullets = [
    efficiencyBullet(season.efficiencyTrend),
    easyPaceBullet(season.paceTrend),
    volumeBullet(comparison, currentYear),
  ].filter((b): b is SeasonHeadlineBullet => b !== null)

  if (bullets.length === 0) return null

  return { title: headlineTitle(bullets), bullets }
}
