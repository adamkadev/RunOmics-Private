import { formatClock, formatDate, formatDecimal, formatDelta, formatDeltaFixed, formatKm } from '@/lib/formatters'
import { deltaTone, type DeltaTone } from '@/lib/deltaTone'
import type { StatTone } from '@/components/ui/Stat'
import { t } from '@/i18n'
import type { AnalyticsBoardData } from './AnalyticsClient'
import { loadCoachHeadline, loadTrendView, loadTrendYMax, recoveryView, type LoadCoachHeadline, type LoadTrendView } from './loadRecoveryView'
import {
  coachRead,
  easyHardView,
  efficiencyView,
  formView,
  isSpeedSignal,
  longRunView,
  missedClusters,
  paceShift,
  predictionRows,
  qualityView,
  thresholdShift,
  weeklyDistanceView,
  weeksIn,
  zonesView,
  type CoachReadView,
  type DayWindow,
  type Period,
  type SpeedKey,
  type Trend,
  type WeekRow,
} from './analyticsView'

/**
 * The coach read, one per tab and period (design review, Oct 2026). One
 * 12-week read sat over all four tabs: the Load headline, "Load is up 21%...
 * Keep building", over race predictions that had all slipped, and a sheet
 * whose bold line said "Speed has slipped". Each tab now reads its own cards'
 * numbers over its own window - the headline is one claim and the rows are
 * the case for it, worse first - so the read and the cards cannot disagree.
 */

export type CoachTab = 'fitness' | 'performance' | 'volume' | 'health'

/**
 * Which way the row's own number moved (App Fixes, rule 04): the arrow
 * follows the number, the colour says whether that is good news. A fatigue
 * of 48, down 23, is a drop drawn in mint - it used to point up, because the
 * arrow was read off the meaning.
 */
export type Direction = 'up' | 'down' | 'level'

export function directionOf(delta: number): Direction {
  return delta > 0 ? 'up' : delta < 0 ? 'down' : 'level'
}

export interface CoachRow {
  trend: Trend
  text: string
  /** Unset where the row carries no number of its own; the trend draws it then. */
  direction?: Direction
}

export interface TabRead {
  tone: StatTone
  headline: string
  rows: CoachRow[]
  /** A second line under the claim, where the claim needs one (App Fixes 2a). */
  note?: string
}

const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })
const joined = (parts: readonly [string, string, string]) => parts.join('')

const TREND_OF: Record<DeltaTone, Trend> = { good: 'improving', worse: 'declining', flat: 'flat' }
const ORDER: Record<Trend, number> = { declining: 0, flat: 1, improving: 2 }

/** Worse first, then level, then better: the sheet reads as the case for its headline. */
function ordered(rows: CoachRow[]): CoachRow[] {
  return rows.map((row, i) => ({ row, i })).sort((a, b) => ORDER[a.row.trend] - ORDER[b.row.trend] || a.i - b.i).map(({ row }) => row)
}

// ─── Load ──────────────────────────────────────────────────────────────────

/** The load headline's words (v5.4), first match of load and recovery. */
export function loadHeadlineText(h: LoadCoachHeadline): string {
  const s = t.analytics.cards.coachRead.load
  const span = t.analytics.cards.loadTrend.span
  switch (h.kind) {
    case 'spikeAndDip':
      return s.spikeAndDip
    case 'spike':
      return h.change ? s.spike(h.change.pct, span(h.change.days)) : s.spikeAbove
    case 'dip':
      return s.dip
    case 'building':
      return h.recovery ? s.building(h.change.pct, span(h.change.days)) : s.buildingLoad(h.change.pct, span(h.change.days))
  }
}

/**
 * The load sentence. In range, it says when - today, or the period's last
 * day once swiped back - and the days that went over come after it as what
 * they are, earlier days (design review, Oct 2026): "still inside your safe
 * range. 15 days went over" read as one claim taking back the other.
 */
export function loadSentence(view: LoadTrendView, live: boolean): readonly [string, string, string] {
  const s = t.analytics.cards.loadTrend
  const change = view.change
  if (view.state === 'below') return s.below
  if (view.state === 'above') return change && change.pct > 0 ? s.jumped(change.pct, s.span(change.days)) : s.above
  const when = live ? s.today : s.onDay(bare(view.last.date))
  const parts =
    !change ? s.inRange(when)
    : Math.abs(change.pct) < 5 ? s.steady(when)
    : change.pct > 0 ? s.upIn(change.pct, s.span(change.days), when)
    : s.downIn(Math.abs(change.pct), s.span(change.days), when)
  // In range now, but the window had days over: say so, so the warn dots
  // under an "inside your safe range" sentence read as history (v5.5 R1).
  if (!view.over) return parts
  return [parts[0], parts[1], `${parts[2]}${s.wentOver(view.over.days, bare(view.over.last))}`]
}

export function loadRead(data: AnalyticsBoardData, today: string, window: DayWindow, period: Period): TabRead | null {
  const s = t.analytics.cards.coachRead
  const within = s.within[period]!
  // Load trend, the Load ratio and the read share one acute/chronic series
  // and one y range per athlete (v5.4).
  const trend = loadTrendView(data.loads, window, loadTrendYMax(data.loads, today))
  const recovery = recoveryView(data.recovery, window)
  const head = loadCoachHeadline(trend, recovery)
  const form = formView(data.load, window)

  // The Why rows in the sheet's fixed order (App Fixes 1b): Load, Fitness,
  // Fatigue, Resting HR, each a bold lead and what it means. Not sorted worse
  // first, so the sheet reads the same way every time.
  const rows: CoachRow[] = []
  if (trend) {
    rows.push({
      trend: trend.state !== 'in' ? 'declining' : trend.change && trend.change.pct >= 5 ? 'improving' : 'flat',
      text: s.loadRow(trend.state, trend.acute, trend.lo, trend.hi),
      direction: trend.change ? directionOf(trend.change.pct) : trend.state === 'below' ? 'down' : trend.state === 'above' ? 'up' : undefined,
    })
  }
  // Fitness a week: the last seven days of the window's fitness line.
  const ramp = form && form.ctl.length > 7 ? Math.round((form.ctl.at(-1)! - form.ctl.at(-8)!) * 10) / 10 : null
  const fitness: CoachRow | null = form
    ? {
        trend: TREND_OF[deltaTone('fitness', form.fitnessDelta)],
        text: s.fitness(Math.round(form.fitness), formatDelta(Math.round(form.fitnessDelta)), within) + (ramp !== null ? s.fitnessNow(Math.abs(ramp) < 0.5 ? 0 : ramp, formatDecimal(Math.abs(ramp), 1)) : ''),
        direction: directionOf(Math.round(form.fitnessDelta)),
      }
    : null
  if (form)
    rows.push(fitness!, {
      trend: TREND_OF[deltaTone('fatigue', form.fatigueDelta)],
      text: s.fatigue(Math.round(form.fatigue), formatDelta(Math.round(form.fatigueDelta)), within) + (s.fatigueNow[form.band] ?? ''),
      direction: directionOf(Math.round(form.fatigueDelta)),
    })
  const rhr = recovery?.restingHr
  if (rhr) rows.push({ trend: rhr.side === 'high' ? 'declining' : rhr.side === 'low' ? 'improving' : 'flat', text: s.restingHrRow(rhr.side, rhr.now, rhr.lo, rhr.hi), direction: rhr.side === 'high' ? 'up' : rhr.side === 'low' ? 'down' : 'level' })

  // No note on the watch's own status: the Training status chart under
  // Form shows it (owner, Oct 2026).
  if (head) return { tone: head.kind === 'building' ? 'pos' : 'warn', headline: loadHeadlineText(head), rows }
  if (trend) return { tone: trend.state !== 'in' ? 'warn' : 'muted', headline: joined(loadSentence(trend, window.live)), rows }
  // Without Garmin's load pair, Fitness is the claim and the rest its case.
  if (!fitness) return null
  return { tone: 'muted', headline: fitness.text, rows: rows.filter((row) => row !== fitness) }
}

// ─── Performance ───────────────────────────────────────────────────────────

/** The speed reads a headline names, joined as the locale lists them. */
function named(keys: SpeedKey[]): { names: string; plural: boolean } {
  const words = keys.map((key) => t.analytics.cards.coachRead.names[key])
  return {
    names: new Intl.ListFormat(t.locale, { style: 'long', type: 'conjunction' }).format(words.map((w) => w.word)),
    plural: words.length > 1 || words.some((w) => w.plural),
  }
}

const capitalized = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * The headline the signals back (v4.16.4): it names only the reads that moved
 * the way it says. "Load is up, but threshold and race predictions haven't
 * followed" was one fixed sentence, printed whichever reads had slipped.
 */
export function readHeadline(view: CoachReadView, period: Period): string {
  const s = t.analytics.cards.coachRead.headline
  const last = t.analytics.cards.coachRead.last[period]!
  const speed = view.signals.filter(isSpeedSignal)
  const improved = named(speed.filter((sig) => sig.trend === 'improving').map((sig) => sig.key))
  const slipped = named(speed.filter((sig) => sig.trend === 'declining').map((sig) => sig.key))
  switch (view.tone) {
    case 'positive':
      return view.loadUp ? s.positive : s.positiveSteadyLoad(last)
    case 'caution':
      return view.loadUp ? s.cautionLoadUp(slipped.names, slipped.plural) : s.caution(last)
    case 'neutral':
      // Level on one vote only because the reads moved both ways.
      return improved.names && slipped.names ? s.mixed(capitalized(improved.names), improved.plural, slipped.names, slipped.plural) : s.neutral(last)
  }
}

/** Each signal as the sentence the sheet prints, over the read's own period. */
export function signalRows(view: CoachReadView, period: Period): CoachRow[] {
  const s = t.analytics.cards.coachRead
  const ago = s.ago[period]!
  const within = s.within[period]!
  const last = s.last[period]!
  return view.signals.map((signal) => {
    switch (signal.key) {
      case 'fitness':
        return { trend: signal.trend, text: s.fitness(Math.round(signal.value), formatDelta(Math.round(signal.delta)), within), direction: directionOf(Math.round(signal.delta)) }
      case 'threshold': {
        const pace = formatClock(signal.pace)
        const text = signal.trend === 'flat' ? s.thresholdLevel(pace, ago) : signal.delta < 0 ? s.thresholdFaster(pace, Math.abs(signal.delta), ago) : s.thresholdSlower(pace, signal.delta, ago)
        return { trend: signal.trend, text, direction: signal.trend === 'flat' ? 'level' : directionOf(signal.delta) }
      }
      case 'easy': {
        const pace = formatClock(signal.pace)
        // Inside the noise band it is level, in words and arrow alike (v5.6
        // #3): "1 s faster" sat beside a flat arrow.
        const text = signal.trend === 'flat' ? s.easyLevel(pace, ago) : signal.delta < 0 ? s.easyFaster(pace, Math.abs(signal.delta), ago) : s.easySlower(pace, signal.delta, ago)
        return { trend: signal.trend, text, direction: signal.trend === 'flat' ? 'level' : directionOf(signal.delta) }
      }
      case 'predictions': {
        const text =
          signal.trend === 'declining' ? s.predictionsSlower(signal.slower, signal.count, ago) : signal.trend === 'improving' ? s.predictionsFaster(signal.faster, signal.count, ago) : s.predictionsHeld(last)
        return { trend: signal.trend, text }
      }
      case 'efficiency': {
        const value = formatDecimal(signal.value, 2)
        const delta = formatDeltaFixed(signal.delta, 2)
        const text = signal.trend === 'flat' ? s.efficiencyLevel(value, ago) : signal.trend === 'improving' ? s.efficiencyUp(value, delta, within) : s.efficiencyDown(value, delta, within)
        return { trend: signal.trend, text, direction: signal.trend === 'flat' ? 'level' : directionOf(signal.delta) }
      }
      case 'volume': {
        const delta = formatDelta(Math.round(signal.delta))
        return { trend: signal.trend, text: signal.since ? s.volumeSince(delta, bare(signal.since)) : s.volume(delta), direction: directionOf(Math.round(signal.delta)) }
      }
    }
  })
}

export function performanceRead(data: AnalyticsBoardData, window: DayWindow, period: Period): TabRead | null {
  const weeks = weeksIn(data.weeks, window)
  const fitness = formView(data.load, window)
  const efficiency = efficiencyView(data.weeks, weeks, window.end)
  const view = coachRead({
    easy: paceShift(weeks, (w) => w.easyPace),
    predictions: predictionRows(data.predictions, window),
    efficiency,
    // A year has no efficiency change of its own: it is left out, not read over 12 weeks.
    efficiencyDelta: efficiency ? (period === '4w' ? efficiency.delta4w : period === '12w' ? efficiency.delta12w : null) : null,
    fitnessDelta: fitness?.fitnessDelta ?? null,
    fitness: fitness?.fitness ?? null,
    threshold: thresholdShift(data.threshold, window),
    // Year to date is Volume's: the Performance read is speed.
    ytd: null,
  })
  if (!view) return null
  return {
    tone: view.tone === 'positive' ? 'pos' : view.tone === 'caution' ? 'warn' : 'muted',
    headline: readHeadline(view, period),
    rows: ordered(signalRows(view, period)),
  }
}

// ─── Volume ────────────────────────────────────────────────────────────────

/** At or above this share of planned weeks on plan, the volume is on plan. */
const ON_PLAN_WEEKS = 0.75
/** Under this share, the plan is mostly not being run. */
const UNDER_PLAN_WEEKS = 0.5
/** The long run over its share in this many finished weeks is a pattern, not a week; off plan, the claim. */
const LONG_RUN_PATTERN = 2

export function volumeRead(data: AnalyticsBoardData, rows: WeekRow[], live: boolean): TabRead | null {
  const cr = t.analytics.cards.coachRead
  const s = cr.volumeTab
  const weekly = weeklyDistanceView(rows, live ? data.weeklyAvgKm : null)
  if (!weekly) return null
  const long = longRunView(rows)
  const finished = rows.filter((r) => !r.current).length
  const plan = weekly.onPlan
  const planShare = plan && plan.of > 0 ? plan.hit / plan.of : null

  const out: CoachRow[] = []
  if (weekly.avg !== null) out.push({ trend: 'flat', text: s.avgRow(formatKm(weekly.avg), live && data.weeklyAvgKm !== null ? 12 : finished) })
  if (plan && planShare !== null) {
    out.push({ trend: planShare >= ON_PLAN_WEEKS ? 'improving' : planShare < UNDER_PLAN_WEEKS ? 'declining' : 'flat', text: s.onPlanRow(plan.hit, plan.of) })
  }
  // Missed sessions that came together are part of the case, never the
  // claim: the headline keeps its own rules (design review, Oct 2026).
  const clusters = missedClusters(data.missed, rows)
  const latest = clusters.at(-1)
  if (latest) {
    const missed = clusters.reduce((sum, c) => sum + c.sessions, 0)
    const [from, to] = [bare(latest.from), bare(latest.to)]
    out.push({ trend: 'declining', text: clusters.length === 1 ? s.missedRow(missed, from, to) : s.missedRows(missed, clusters.length, from, to) })
  }
  if (long) out.push({ trend: long.over > 0 ? 'declining' : 'improving', text: s.longRunRow(long.over) })
  const ytd = data.ytd?.vsLastYear
  if (ytd && live) {
    const delta = ytd.km - ytd.lastYearKm
    const text = ytd.since ? cr.volumeSince(formatDelta(Math.round(delta)), bare(ytd.since)) : cr.volume(formatDelta(Math.round(delta)))
    out.push({ trend: TREND_OF[deltaTone('distance', delta, { value: ytd.km })], text, direction: directionOf(delta) })
  }

  // The plan first: the coach sets each week's long run against its week, so
  // on plan, a long run over its share (three light weeks of a break, Aug
  // 2026) is the case's first line rather than the claim.
  if (plan && plan.of >= 2 && planShare !== null && planShare < UNDER_PLAN_WEEKS) return { tone: 'warn', headline: s.underPlan(plan.hit, plan.of), rows: ordered(out) }
  if (plan && plan.of >= 2 && planShare !== null && planShare >= ON_PLAN_WEEKS) return { tone: 'pos', headline: s.onPlan(plan.hit, plan.of), rows: ordered(out) }
  if (long && long.over >= LONG_RUN_PATTERN) return { tone: 'warn', headline: s.longRunOver(long.over, finished), rows: ordered(out) }
  if (weekly.avg !== null) return { tone: 'muted', headline: s.average(formatKm(weekly.avg)), rows: ordered(out.slice(1)) }
  return null
}

// ─── Intensity ─────────────────────────────────────────────────────────────

const sessions = (n: number) => formatKm(n, Number.isInteger(n) ? 0 : 1)

export function intensityRead(data: AnalyticsBoardData, rows: WeekRow[]): TabRead | null {
  const s = t.analytics.cards.coachRead.intensityTab
  const mix = easyHardView(rows)
  if (!mix) return null
  const zones = zonesView(rows)
  const quality = qualityView(rows, data.plan)
  const out: CoachRow[] = [{ trend: mix.status === 'inRange' ? 'improving' : 'declining', text: s.splitRow(mix.easyPct, mix.moderatePct, mix.hardPct) }]
  if (zones?.hard) out.push({ trend: 'flat', text: s.hardRow(zones.hard.lo === zones.hard.hi ? `${zones.hard.lo}` : `${zones.hard.lo}–${zones.hard.hi}`) })
  if (quality && quality.avg !== null) {
    const short = quality.planAsks !== null && quality.avg < quality.planAsks
    out.push({ trend: short ? 'declining' : 'flat', text: quality.planAsks !== null ? s.qualityPlanRow(sessions(quality.avg), sessions(quality.planAsks)) : s.qualityRow(sessions(quality.avg)) })
  }
  const headline = mix.status === 'inRange' ? s.inRange(mix.easyPct) : mix.status === 'tooModerate' ? s.tooModerate(mix.moderatePct) : s.tooHard(mix.easyPct)
  return { tone: mix.status === 'inRange' ? 'pos' : 'warn', headline, rows: ordered(out) }
}

// ─── The read for the tab on screen ────────────────────────────────────────

export interface TabReadInput {
  tab: CoachTab
  data: AnalyticsBoardData
  today: string
  period: Period
  /** The Load and Performance tabs' window. */
  days: DayWindow | null
  /** The Volume and Intensity tabs' weeks. */
  rows: WeekRow[]
  live: boolean
}

export function tabRead({ tab, data, today, period, days, rows, live }: TabReadInput): TabRead | null {
  switch (tab) {
    case 'fitness':
      return days ? loadRead(data, today, days, period) : null
    case 'performance':
      return days ? performanceRead(data, days, period) : null
    case 'volume':
      return volumeRead(data, rows, live)
    case 'health':
      return intensityRead(data, rows)
  }
}
