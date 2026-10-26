'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { HeatImpactData } from '@/application/usecases/GetHeatImpact'
import { formatClock, formatDate, formatDecimal, formatDeltaFixed, formatDuration, MINUS, PLUS_MINUS } from '@/lib/formatters'
import { deltaColor, deltaTone } from '@/lib/deltaTone'
import { cardClass } from '@/components/ui/Card'
import { Stat, StatGrid } from '@/components/ui/Stat'
import { t } from '@/i18n'
import { AxisLabels, Card, CardHead, ChartScrub, Headline, Legend, LegendItem, STAT_TONE, Sentence, Spark } from './AnalyticsKit'
import { linePath } from '@/lib/linePath'
import type { RunBests } from '@/domain/activity/paceCurve'
import { PaceCurveCard } from './PaceCurveCard'
import {
  efficiencyView,
  heatView,
  paceShift,
  predictionRows,
  predictionTrend,
  rpeView,
  smooth,
  thin,
  thresholdShift,
  vo2View,
  weeksIn,
  type DayWindow,
  type GoalRaceInput,
  type LoadPeriod,
  type PaceShift,
  type PredictionDay,
} from './analyticsView'
import { FORM_DECIMALS, formLead, formRows } from './trendView'

const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

/** A pace change under this is no change: deltaTone's own band for pace. */
const PACE_FLAT_SEC = 3

/** A change in time, as the rows print it: "33 s", or "9:17" past a minute. */
export function changeAmount(seconds: number): string {
  const abs = Math.abs(Math.round(seconds))
  return abs >= 60 ? formatDuration(abs) : t.analytics.cards.summary.secs(abs)
}

/**
 * "9 s slower", "28 s faster", or "1:10 slower" once it is past a minute. Inside `flatBelow` it is "no change", so a
 * tile never says "1 s faster" beside a muted, flat delta.
 */
export function shiftWords(delta: number | null, flatBelow = 1): string | null {
  const s = t.analytics.cards.summary
  if (delta === null) return null
  if (Math.abs(Math.round(delta)) < flatBelow) return s.same
  return delta > 0 ? s.slower(changeAmount(delta)) : s.faster(changeAmount(delta))
}

/** Under this a threshold move is "flat": grey "+4 s · flat", not an amber slowdown. */
const THRESHOLD_FLAT_SEC = 5

/** Threshold's note: "no change", "+4 s · flat" under 5 s, else "9 s slower". */
export function thresholdWords(delta: number | null): string | null {
  if (delta === null) return null
  const r = Math.round(delta)
  if (r === 0) return t.analytics.cards.summary.same
  if (Math.abs(r) < THRESHOLD_FLAT_SEC) return t.analytics.cards.summary.flat(signedChange(r)!)
  return shiftWords(delta, PACE_FLAT_SEC)
}

/** "+33 s", "−1:10", or "0 s": a signed change that fits its column. */
export function signedChange(delta: number | null): string | null {
  if (delta === null) return null
  const r = Math.round(delta)
  if (r === 0) return t.analytics.cards.summary.secs(0)
  return `${r > 0 ? '+' : MINUS}${changeAmount(r)}`
}

/** Month initials under a weekly chart, or dates for a four-week one. */
export function timeLabels(dates: string[]): string[] {
  if (dates.length <= 6) return dates.map(bare)
  const labels: string[] = []
  let month = ''
  for (const date of dates) {
    const m = date.slice(0, 7)
    if (m !== month) {
      month = m
      labels.push(formatDate(`${m}-01`, { precision: 'month', year: 'never' }))
    }
  }
  // The first month is usually a partial one at the left edge.
  const shown = labels.length > 6 ? labels.slice(1) : labels
  const step = Math.ceil(shown.length / 6)
  return shown.filter((_, i) => i % step === 0)
}

/** VO₂max's home is Athlete & zones: its stat here is a summary that opens it. */
const VO2_HOME = '/athlete'

function SummaryStrip({ vo2, threshold, easy }: { vo2: ReturnType<typeof vo2View>; threshold: PaceShift | null; easy: PaceShift | null }) {
  const s = t.analytics.cards.summary
  const cells = [
    vo2 && {
      label: s.vo2max,
      value: formatDecimal(vo2.value, 1),
      unit: undefined,
      // A flat VO2max is "±0.0", the decimal every other VO2max number on the screen carries, in the reader's own
      // decimal mark.
      note:
        vo2.delta === null
          ? null
          : s.in12w(
              vo2.delta === 0
                ? `${PLUS_MINUS}${formatDecimal(0, 1)}`
                : vo2.delta > 0
                  ? `+${formatDecimal(vo2.delta, 1)}`
                  : `${MINUS}${formatDecimal(Math.abs(vo2.delta), 1)}`,
            ),
      tone: STAT_TONE[deltaTone('vo2max', vo2.delta)],
      href: VO2_HOME,
    },
    threshold && {
      label: s.threshold,
      value: formatClock(threshold.now),
      unit: t.units.perKm,
      note: thresholdWords(threshold.delta),
      tone: threshold.delta !== null && Math.abs(Math.round(threshold.delta)) < THRESHOLD_FLAT_SEC ? STAT_TONE.flat : STAT_TONE[deltaTone('pace', threshold.delta)],
      href: null,
    },
    easy && { label: s.easyPace, value: formatClock(easy.now), unit: t.units.perKm, note: shiftWords(easy.delta, PACE_FLAT_SEC), tone: STAT_TONE[deltaTone('pace', easy.delta)], href: null },
  ].filter((c) => !!c)
  if (!cells.length) return null
  return (
    <section className={cardClass()} data-testid="performance-summary">
      <StatGrid columns={cells.length} className="gap-3 sm:gap-4">
        {cells.map((c) => {
          const stat = (
            <Stat
              key={c.label}
              size="lg"
              label={
                c.href ? (
                  <span className="inline-flex items-center gap-0.5">
                    {c.label}
                    <ChevronRight size={12} strokeWidth={2.4} aria-hidden />
                  </span>
                ) : (
                  c.label
                )
              }
              value={c.value}
              unit={c.unit}
              meaning={c.note && <span data-testid="summary-delta" data-tone={c.tone}>{c.note}</span>}
              tone={c.tone}
            />
          )
          // The whole stat opens its home, a 44 pt target and more.
          return c.href ? (
            <Link key={c.label} href={c.href} className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="vo2-link">
              {stat}
            </Link>
          ) : (
            stat
          )
        })}
      </StatGrid>
    </section>
  )
}

function PredictionsCard({ days, window, period, race }: { days: PredictionDay[]; window: DayWindow; period: LoadPeriod; race: GoalRaceInput | null }) {
  const s = t.analytics.cards.predictions
  const names = t.records.distances
  const rows = predictionRows(days, window)
  if (!rows.length) return null
  const trend = predictionTrend(rows)
  const words = t.analytics.cards.period.words[period]!
  const who = s.count(trend?.count ?? rows.length)
  // Each end in the rows' own format: "33 s-9:17".
  const range = trend && 'lo' in trend ? s.range(changeAmount(trend.lo), changeAmount(trend.hi)) : ''
  const lead =
    trend === null
      ? null
      : trend.kind === 'slipped'
        ? trend.count < trend.of ? s.someSlipped(trend.count, trend.of, range, words) : s.slipped(who, range, words)
        : trend.kind === 'improved'
          ? trend.count < trend.of ? s.someImproved(trend.count, trend.of, range, words) : s.improved(who, range, words)
          : trend.kind === 'mixed'
            ? s.mixed(trend.faster, trend.count, words)
            : s.held(who, words)
  const goalRow = race ? rows.find((r) => r.distance === race.distance) : undefined
  const gap = goalRow && race?.targetSeconds ? goalRow.seconds - race.targetSeconds : null
  // Warn off the target and pos inside it, as Goals' season rows colour the same gap.
  const goal =
    gap !== null && race?.targetSeconds
      ? (gap > 0 ? s.offTarget : s.onTarget)(names[race.distance]!, formatDuration(Math.round(Math.abs(gap))), formatDuration(race.targetSeconds))
      : null
  return (
    <Card className="gap-2" testId="predictions-card">
      <CardHead title={s.title} caption={s.caption(words)} about={s.about} />
      {(lead || goal) && (
        <Sentence className="mb-1.5" testId="predictions-sentence">
          {lead}
          {lead && goal && ' '}
          {goal && (
            <>
              {goal[0]}
              <b style={{ color: gap! > 0 ? 'var(--warn)' : 'var(--pos)' }} data-testid="predictions-gap">
                {goal[1]}
              </b>
              {goal[2]}
            </>
          )}
        </Sentence>
      )}
      {/* One grid for every row, each row a subgrid, so the time column sizes to the widest time and the times align. */}
      <div className="grid grid-cols-[76px_minmax(0,1fr)_auto] gap-x-3 sm:grid-cols-[120px_1fr_minmax(0,360px)_auto] sm:gap-x-3.5" data-testid="predictions-grid">
        {rows.map((row) => (
          <div
            key={row.distance}
            className="col-span-3 grid grid-cols-subgrid items-center border-t border-border py-2.5 sm:col-span-4"
            data-testid={`prediction-${row.distance}`}
          >
            <span className="text-sm font-medium text-foreground">{names[row.distance]}</span>
            <span aria-hidden className="hidden sm:block" />
            <Spark values={thin(row.series)} lowerUp />
            <span className="flex items-baseline justify-end gap-3" data-testid="prediction-time">
              <span className="min-w-[72px] text-right text-[15px] font-semibold leading-none text-foreground sm:min-w-0">{formatDuration(Math.round(row.seconds))}</span>
              {/* Signed, on one line: the header already says "change in 12 weeks". A fixed width, so the times line up. */}
              <span
                className="w-[52px] whitespace-nowrap text-right text-xs leading-tight sm:w-[60px]"
                style={{ color: deltaColor('race', row.delta, { value: row.seconds }) }}
                data-testid="prediction-delta"
              >
                {signedChange(row.delta) ?? ''}
              </span>
            </span>
          </div>
        ))}
      </div>
      {race && (
        // A date, not a warning: muted, as every caption.
        <span className="pt-1.5 text-xs text-muted-foreground" data-testid="predictions-race">
          {s.race(names[race.distance]!)}
          {bare(race.date)} · {s.inDays(race.daysUntil)}
        </span>
      )}
    </Card>
  )
}

/** A trend row as Race predictions draws one: the name, its line, the value now and its change. */
function TrendRow({ label, line, value, unit, change, changeColor, testId }: { label: string; line: ReactNode; value: string; unit: string; change: string; changeColor: string; testId: string }) {
  return (
    <div className="col-span-3 grid grid-cols-subgrid items-center border-t border-border py-2.5" data-testid={testId}>
      <span className="text-sm font-medium leading-tight text-foreground">{label}</span>
      {line}
      <span className="flex items-baseline justify-end gap-3">
        <span className="whitespace-nowrap text-right text-[15px] font-semibold leading-none text-foreground">
          {value}
          <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
        </span>
        <span className="w-[44px] whitespace-nowrap text-right text-xs leading-tight" style={{ color: changeColor }} data-testid="trend-change">
          {change}
        </span>
      </span>
    </div>
  )
}

const TREND_GRID = 'grid grid-cols-[minmax(0,104px)_minmax(0,1fr)_auto] gap-x-3'

function RunningFormCard({ weeks, period }: { weeks: WeeklyTrendPoint[]; period: LoadPeriod }) {
  const s = t.analytics.charts.runningForm
  const rows = formRows(weeks)
  if (!rows.length) return null
  const lead = formLead(rows)
  const sentence = lead
    ? s.reading[lead.delta! > 0 ? 'up' : 'down'](s.metrics[lead.metric]!, formatDecimal(Math.abs(lead.delta!), FORM_DECIMALS[lead.metric]), s.unit[lead.metric]!)
    : s.reading.flat(s.title)
  return (
    <Card className="gap-2" testId="running-form-card">
      <CardHead title={s.title} caption={t.analytics.cards.predictions.caption(t.analytics.cards.period.words[period]!)} about={rows.map((r) => s.footnote[r.metric]).join(' ')} />
      <Sentence className="mb-1.5" testId="running-form-sentence">{sentence}</Sentence>
      <div className={TREND_GRID}>
        {rows.map((row) => (
          <TrendRow
            key={row.metric}
            testId={`form-${row.metric}`}
            label={s.metrics[row.metric]!}
            line={<Spark values={smooth(row.series).filter((v): v is number => v !== null)} />}
            value={formatDecimal(row.now, FORM_DECIMALS[row.metric])}
            unit={s.unit[row.metric]!}
            change={row.delta === null ? '' : formatDeltaFixed(row.delta, FORM_DECIMALS[row.metric])}
            changeColor={row.moved ? 'var(--text-2)' : 'var(--muted-foreground)'}
          />
        ))}
      </div>
    </Card>
  )
}

/** The least air above and below the lines, in s/km; 5% of their range when that is more. */
export const PACE_PAD_MIN = 5
const PACE_PAD_SHARE = 0.05
/** The domain's limits land on a multiple of this many seconds. */
const PACE_ROUND = 5

/**
 * From the drawn, smoothed paces, not the raw weeks, whose outliers leave the lines in the top half. The labels are
 * the two edges and the middle; the domain grows by 5 s when needed to keep the middle on a 5 s pace.
 */
export function paceAxis(paces: readonly number[]): { lo: number; hi: number; ticks: [number, number, number] } {
  const min = Math.min(...paces)
  const max = Math.max(...paces)
  const pad = Math.max(PACE_PAD_MIN, (max - min) * PACE_PAD_SHARE)
  const lo = Math.floor((min - pad) / PACE_ROUND) * PACE_ROUND
  const rounded = Math.ceil((max + pad) / PACE_ROUND) * PACE_ROUND
  const hi = (rounded - lo) % (2 * PACE_ROUND) === 0 ? rounded : rounded + PACE_ROUND
  return { lo, hi, ticks: [lo, (lo + hi) / 2, hi] }
}

function PacePart({ parts, delta }: { parts: readonly [string, string, string]; delta: number | null }) {
  return (
    <>
      {parts[0]}
      <b style={delta === null ? undefined : { color: deltaColor('pace', delta) }}>{parts[1]}</b>
      {parts[2]}
    </>
  )
}

function PaceTrendCard({ weeks, easy, workout, onShift }: { weeks: WeeklyTrendPoint[]; easy: PaceShift | null; workout: PaceShift | null; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.paceTrend
  // The lines as drawn, so the domain fits what is on the chart.
  const easyLine = smooth(weeks.map((w) => w.easyPace))
  const hardLine = smooth(weeks.map((w) => w.hardPace))
  const paces = [...easyLine, ...hardLine].filter((v): v is number => v !== null)
  if (!easy || paces.length < 2) return null
  const { lo, hi, ticks } = paceAxis(paces)
  const W = 1000
  const H = 120
  // Faster is up: a pace's height from the top is its share of the way to the slowest.
  const yOf = (pace: number) => (H * (pace - lo)) / (hi - lo)
  // Faster is up: the axis runs from the slowest pace at the bottom.
  const path = (line: (number | null)[]) => linePath(line.map((v) => (v === null ? null : -v)), -hi, -lo, W, H)
  const shift = easy.delta === null || Math.abs(easy.delta) < 1 ? null : easy.delta
  const easyParts = shift === null ? s.easyHeld : shift < 0 ? s.easyFaster(`${Math.abs(shift)} s`) : s.easySlower(`${shift} s`)
  const wShift = workout?.delta ?? null
  const wHeld = wShift !== null && Math.abs(wShift) < 5
  const workoutParts = wShift === null ? null : wHeld ? s.workoutHeld : wShift < 0 ? s.workoutFaster(`${Math.abs(wShift)} s`) : s.workoutSlower(`${wShift} s`)
  return (
    <Card testId="pace-trend-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <Sentence>
        <PacePart parts={easyParts} delta={shift} />
        {workoutParts && <PacePart parts={workoutParts} delta={wHeld ? null : wShift} />}
      </Sentence>
      {/* Outside the scrub, so a touch still reads the week under it; the outer two paces sit on the chart's edges, so
          a little room above and below for them. */}
      <div className="flex gap-2 py-1.5">
        <div className="relative w-8 shrink-0 text-[11px] leading-none text-muted-foreground" style={{ height: H }} aria-hidden data-testid="pace-axis">
          {ticks.map((pace) => (
            <span key={pace} className="absolute right-0 -translate-y-1/2" style={{ top: `${(yOf(pace) / H) * 100}%` }}>
              {formatClock(pace)}
            </span>
          ))}
        </div>
        <ChartScrub
          className="min-w-0 flex-1"
          count={weeks.length}
          mode="line"
          onShift={onShift}
          readout={(i) => {
            const w = weeks[i]!
            return [t.analytics.cards.scrubWeek(bare(w.date)), w.easyPace && `${s.easy} ${formatClock(w.easyPace)}`, w.hardPace && `${s.workout} ${formatClock(w.hardPace)}`].filter(Boolean).join(' · ')
          }}
        >
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
            {ticks.map((pace) => (
              <line key={pace} x1="0" x2={W} y1={yOf(pace)} y2={yOf(pace)} stroke="var(--line-2)" vectorEffect="non-scaling-stroke" data-testid="pace-gridline" />
            ))}
            {/* Workouts Z4, easy runs Z2: the two run types' own zones. */}
            <path d={path(hardLine)} fill="none" stroke="var(--zone-4)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <path d={path(easyLine)} fill="none" stroke="var(--zone-2)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        </ChartScrub>
      </div>
      <AxisLabels className="ml-10" labels={timeLabels(weeks.map((w) => w.date))} />
      <Legend className="gap-x-4">
        <LegendItem swatch="dot" color="var(--zone-2)">
          {s.easy} <b className="font-semibold text-foreground">{formatClock(easy.now)}</b>
        </LegendItem>
        {workout && (
          <LegendItem swatch="dot" color="var(--zone-4)">
            {s.workout} <b className="font-semibold text-foreground">{formatClock(workout.now)}</b>
          </LegendItem>
        )}
      </Legend>
    </Card>
  )
}

/** The smallest efficiency range the chart spreads over its height, in m a beat. */
const EFFICIENCY_MIN_SPAN = 0.04

function EfficiencyCard({ allWeeks, weeks, end, onShift }: { allWeeks: WeeklyTrendPoint[]; weeks: WeeklyTrendPoint[]; end: string; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.efficiency
  const view = efficiencyView(allWeeks, weeks, end)
  if (!view) return null
  const rpe = rpeView(allWeeks, end)
  const values = [...view.adjusted, ...view.measured].filter((v): v is number => v !== null)
  // The lines' own range, 10 % either side; the floor keeps a level month from filling the chart with noise.
  const mid = (Math.min(...values) + Math.max(...values)) / 2
  const half = Math.max(Math.max(...values) - Math.min(...values), EFFICIENCY_MIN_SPAN) * 0.6
  const min = mid - half
  const max = mid + half
  const W = 1000
  const H = 72
  const d = (v: number | null) => (v === null ? '–' : formatDeltaFixed(v, 2))
  const sentence =
    view.trend === 'dipping'
      ? `${s.dipping}${view.heatCost !== null && view.heatCost >= 0.01 ? s.dippingHeat(formatDecimal(view.heatCost, 2)) : s.dippingNoHeat}`
      : view.trend === 'rising'
        ? s.rising
        : s.steady
  const rpeMax = Math.max(...(rpe?.bars.filter((v): v is number => v !== null) ?? [1]), 1)
  return (
    <Card testId="efficiency-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <Headline
        value={formatDecimal(view.now, 2)}
        note={
          view.delta4w !== null || view.delta12w !== null ? (
            <span data-testid="efficiency-deltas">
              <span style={{ color: deltaColor('efficiency', view.delta4w) }}>
                {d(view.delta4w)}
                {s.in4w}
              </span>
              {' · '}
              <span style={{ color: deltaColor('efficiency', view.delta12w) }}>
                {d(view.delta12w)}
                {s.in12w}
              </span>
            </span>
          ) : undefined
        }
      />
      <Sentence>{sentence}</Sentence>
      <ChartScrub
        count={view.dates.length}
        mode="line"
        onShift={onShift}
        readout={(i) => [t.analytics.cards.scrubWeek(bare(view.dates[i]!)), view.adjusted[i] != null && `${s.adjusted} ${formatDecimal(view.adjusted[i]!, 2)}`].filter(Boolean).join(' · ')}
      >
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
          <path d={linePath(smooth(view.measured), min, max, W, H)} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          <path d={linePath(smooth(view.adjusted), min, max, W, H)} fill="none" stroke="var(--foreground)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </ChartScrub>
      <Legend className="gap-x-4">
        <LegendItem swatch="line" color="var(--foreground)">{s.adjusted}</LegendItem>
        <LegendItem swatch="dash" color="var(--muted-foreground)">{s.measured}</LegendItem>
      </Legend>
      {rpe && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-t border-border pt-3" data-testid="rpe-row">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{s.rpe}</span>
            <span className="text-xs text-muted-foreground">{s.rpeLine(formatDecimal(rpe.avg, 1), s.rpeTrend[rpe.trend]!)}</span>
          </div>
          <div className="flex h-[26px] items-end gap-[3px]" aria-hidden>
            {rpe.bars.map((v, i) => (
              <div key={i} className="w-[7px] rounded-[2px]" style={{ height: v === null ? 2 : Math.max(2, (v / rpeMax) * 24), background: i === rpe.bars.length - 1 ? 'var(--foreground)' : 'var(--series-2)' }} />
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

/** A cost under this many seconds a km is noise, and goes unsaid. */
const COST_WORTH_SAYING = 5

/** A heat loss past this many seconds a km is worth a caution; less stays muted. */
export const HEAT_WARN_SEC = 10

export function heatColor(row: { best: boolean; cost: number | null }): string {
  if (row.best) return 'var(--pos)'
  return row.cost !== null && row.cost > HEAT_WARN_SEC ? 'var(--warn)' : 'var(--muted-foreground)'
}

/**
 * Each band's bar is the seconds a km it loses against your best temperature band at the same heart rate. A band
 * without runs has a dashed, empty track: drawn like the best band's, it would read as the best.
 */
function HeatCostCard({ data }: { data: HeatImpactData | null }) {
  const s = t.analytics.cards.heatCost
  const view = heatView(data)
  if (!view) return null
  const labels = t.analytics.charts.heatImpact.bands
  const range = view.warm ? (view.warm.lo === view.warm.hi ? `${view.warm.hi}` : `${view.warm.lo}–${view.warm.hi}`) : null
  return (
    <Card className="gap-2.5" testId="heat-card">
      <CardHead title={s.title} caption={s.caption(view.refHeartRate)} about={s.about} />
      <div className="mb-1">
        {(() => {
          const best = view.rows.find((row) => row.best)
          const cold = view.cold !== null && view.cold >= COST_WORTH_SAYING ? view.cold : null
          const warm = view.warm !== null && view.warm.hi >= COST_WORTH_SAYING ? range : null
          if (view.warm === null && view.cold === null) return <Sentence>{s.noWarm}</Sentence>
          if (cold === null && warm === null) return <Sentence>{s.little}</Sentence>
          const bold = ([a, b, c]: [string, string, string]) => (
            <>
              {a}
              <b className="font-semibold text-foreground">{b}</b>
              {c}
            </>
          )
          return (
            <p className="text-[13px] leading-[1.45] text-[var(--text-2)]" data-testid="heat-summary">
              {best && s.fastest(labels[best.id] ?? '')}
              {cold !== null && bold(s.coldCosts(String(cold)))}
              {warm !== null && bold(s.warmCosts(warm, cold !== null))}
              .
            </p>
          )
        })()}
      </div>
      <div className="flex flex-col gap-2.5">
        {view.rows.map((row) => {
          const color = heatColor(row)
          return (
            <div key={row.id} className="grid grid-cols-[60px_minmax(0,1fr)_96px] items-center gap-3 text-[13px] sm:grid-cols-[72px_minmax(0,1fr)_110px] sm:gap-3.5" data-testid={`heat-${row.id}`}>
              <span className="whitespace-nowrap text-[var(--text-2)]">{labels[row.id]}</span>
              <div
                className={row.pace === null ? 'box-border h-2 rounded-full border border-dashed border-muted-foreground' : 'relative h-2 rounded-full bg-[var(--line-2)]'}
                data-testid={row.pace === null ? 'heat-empty' : undefined}
              >
                {row.best ? (
                  <span aria-hidden className="absolute left-0 top-1/2 size-2.5 -translate-y-1/2 rounded-full" style={{ background: color }} data-testid="heat-zero" />
                ) : (
                  row.cost !== null && <div className="h-full rounded-full" style={{ width: `${Math.min(1, row.cost / view.scale) * 100}%`, background: color }} data-testid="heat-bar" />
                )}
              </div>
              <span className="text-right">
                {row.pace === null ? (
                  <>
                    <b className="font-semibold text-foreground">—</b> <span className="text-muted-foreground">{s.noRuns}</span>
                  </>
                ) : (
                  <>
                    <b className="font-semibold text-foreground">{formatClock(row.pace)}</b>{' '}
                    <span style={{ color }} data-testid="heat-loss">
                      {row.best ? s.best : s.plus(row.cost!)}
                    </span>
                  </>
                )}
              </span>
            </div>
          )
        })}
      </div>
      <p className="pt-1 text-xs text-muted-foreground" data-testid="heat-key">{s.barKey}</p>
    </Card>
  )
}

export interface PerformanceTabProps {
  window: DayWindow
  period: LoadPeriod
  onShift: (step: 1 | -1) => void
  today: string
  weeks: WeeklyTrendPoint[]
  vo2max: { value: number | null; samples: { date: string; vo2max: number }[] }
  threshold: { date: string; pace: number }[]
  predictions: PredictionDay[]
  race: GoalRaceInput | null
  heat: HeatImpactData | null
  paceBests: RunBests[]
}

export function PerformanceTab({ window, period, onShift, today, weeks, vo2max, threshold, predictions, race, heat, paceBests }: PerformanceTabProps) {
  const inWindow = weeksIn(weeks, window)
  const easy = paceShift(inWindow, (w) => w.easyPace)
  const workout = paceShift(inWindow, (w) => w.hardPace)
  return (
    <div className="flex flex-col gap-3.5">
      <SummaryStrip vo2={vo2View(window.live ? vo2max.value : null, vo2max.samples, window.live ? today : window.end)} threshold={thresholdShift(threshold, window)} easy={easy} />
      <PredictionsCard days={predictions} window={window} period={period} race={window.live ? race : null} />
      <PaceCurveCard runs={paceBests} window={window} period={period} threshold={threshold} onShift={onShift} />
      <PaceTrendCard weeks={inWindow} easy={easy} workout={workout} onShift={onShift} />
      <EfficiencyCard allWeeks={weeks} weeks={inWindow} end={window.end} onShift={onShift} />
      <RunningFormCard weeks={inWindow} period={period} />
      <HeatCostCard data={heat} />
    </div>
  )
}
