import { t } from '@/i18n'
import { formatClock, formatPace } from '@/lib/formatters'
import { median, round } from '@/lib/math'
import type { AnalyticsPageData, WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
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
const BLOCK_WEEKS = 4
const MIN_WEEKS = BLOCK_WEEKS * 2

// One week can hold a single slow recovery jog, so comparing week 1 to the
// current week turns that noise into a headline (a 171s/km "gain"). Medians
// over the first and last blocks of the season keep the claim to what actually
// shifted, and below two blocks there is nothing to compare yet.
function seasonShift(
  weeks: WeeklyTrendPoint[],
  pick: (w: WeeklyTrendPoint) => number | null,
): { start: number; now: number } | null {
  const known = weeks.map(pick).filter((v): v is number => v !== null)
  if (known.length < MIN_WEEKS) return null
  return { start: median(known.slice(0, BLOCK_WEEKS)), now: median(known.slice(-BLOCK_WEEKS)) }
}

function efficiencyBullet(weeks: WeeklyTrendPoint[]): SeasonHeadlineBullet | null {
  const shift = seasonShift(weeks, (w) => w.ef)
  if (!shift) return null
  const diff = round(shift.now - shift.start, 2)
  if (Math.abs(diff) < EFFICIENCY_THRESHOLD) return null
  return { tone: diff > 0 ? 'positive' : 'caution', text: t.analytics.seasonHeadline.efficiency(diff) }
}

function easyPaceBullet(weeks: WeeklyTrendPoint[]): SeasonHeadlineBullet | null {
  const shift = seasonShift(weeks, (w) => w.easyPace)
  if (!shift) return null
  if (Math.abs(shift.now - shift.start) < EASY_PACE_THRESHOLD_SEC) return null
  return {
    tone: shift.now < shift.start ? 'positive' : 'caution',
    text: t.analytics.seasonHeadline.easyPace(formatPace(shift.now), formatClock(shift.start), BLOCK_WEEKS),
  }
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
// computed elsewhere (the weekly trend base + year-over-year comparison) - no
// new aggregation, just a reading of the current calendar year's weeks. Returns
// null when nothing crosses the signal thresholds, so the card stays honest
// rather than forcing a verdict.
export function getSeasonHeadline(
  data: AnalyticsPageData,
  comparison: YearComparisonData | null,
): SeasonHeadlineData | null {
  const currentYear = data.years[0]
  if (currentYear === undefined) return null

  const prefix = `${currentYear}-`
  const seasonWeeks = data.weeklyTrends.filter((w) => w.date.startsWith(prefix))

  const bullets = [
    efficiencyBullet(seasonWeeks),
    easyPaceBullet(seasonWeeks),
    volumeBullet(comparison, currentYear),
  ].filter((b): b is SeasonHeadlineBullet => b !== null)

  if (bullets.length === 0) return null

  return { title: headlineTitle(bullets), bullets }
}
