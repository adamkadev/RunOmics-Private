'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { HeatImpactData } from '@/application/usecases/GetHeatImpact'
import { formatClock, formatDate, formatDecimal, formatDeltaFixed, formatDuration, MINUS, PLUS_MINUS } from '@/lib/formatters'
import { deltaColor, deltaTone } from '@/lib/deltaTone'
import { cardClass } from '@/components/ui/Card'
import { Stat, StatGrid } from '@/components/ui/Stat'
import { t } from '@/i18n'
import { AxisLabels, BoldSentence, Card, CardHead, ChartScrub, Headline, Legend, LegendItem, STAT_TONE, Sentence, linePath } from './AnalyticsKit'
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

const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

/** A pace change under this is no change: deltaTone's own band for pace. */
const PACE_FLAT_SEC = 3

/** A change in time, as the rows print it: "33 s", or "9:17" past a minute. */
export function changeAmount(seconds: number): string {
  const abs = Math.abs(Math.round(seconds))
  return abs >= 60 ? formatDuration(abs) : t.analytics.cards.summary.secs(abs)
}

/**
 * "9 s slower", "28 s faster", or "1:10 slower" once it is past a minute.
 * Inside `flatBelow` it is "no change" (v5.6 #3): a pace tile said "1 s
 * faster" beside a muted, flat delta.
 */
export function shiftWords(delta: number | null, flatBelow = 1): string | null {
  const s = t.analytics.cards.summary
  if (delta === null) return null
  if (Math.abs(Math.round(delta)) < flatBelow) return s.same
  return delta > 0 ? s.slower(changeAmount(delta)) : s.faster(changeAmount(delta))
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

/** VO₂max's home is Athlete & zones (design review, Oct 2026): its stat here is a summary that opens it. */
const VO2_HOME = '/athlete'

/** The tab's stat row (v4.17): VO₂max, threshold and easy pace, each with what its change means. */
function SummaryStrip({ vo2, threshold, easy }: { vo2: ReturnType<typeof vo2View>; threshold: PaceShift | null; easy: PaceShift | null }) {
  const s = t.analytics.cards.summary
  const cells = [
    vo2 && {
      label: s.vo2max,
      value: formatDecimal(vo2.value, 1),
      unit: undefined,
      // A flat VO2max is "±0.0", the decimal every other VO2max number on
      // the screen carries, and in the reader's own decimal mark (review 13).
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
    threshold && { label: s.threshold, value: formatClock(threshold.now), unit: t.units.perKm, note: shiftWords(threshold.delta, PACE_FLAT_SEC), tone: STAT_TONE[deltaTone('pace', threshold.delta)], href: null },
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

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min) * 0.3 || 1
  // Faster is up: a smaller time sits higher.
  return (
    <svg width="100%" height="24" viewBox="0 0 1000 24" preserveAspectRatio="none" className="block" aria-hidden>
      <path d={linePath(values.map((v) => -v), -(max + pad), -(min - pad), 1000, 24)} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
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
  // Each end in the rows' own format: "33 s-9:17" (v4.8).
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
  // The goal race's gap to its target, after the trend (design review, Oct
  // 2026): its figure in bold, warn off the target and pos inside it, as
  // Goals' season rows colour the same gap.
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
      {/* One grid for every row, each row a subgrid, so the time column
          sizes to the widest time and the times align (v4.17.3): the
          distance, a spacer, the sparkline right up against the time - no
          600 px gap between them - and the time with its change. On a
          phone the spacer goes and the row stays as it was. */}
      <div className="grid grid-cols-[76px_minmax(0,1fr)_auto] gap-x-3 sm:grid-cols-[120px_1fr_minmax(0,360px)_auto] sm:gap-x-3.5" data-testid="predictions-grid">
        {rows.map((row) => (
          <div
            key={row.distance}
            className="col-span-3 grid grid-cols-subgrid items-center border-t border-border py-2.5 sm:col-span-4"
            data-testid={`prediction-${row.distance}`}
          >
            <span className="text-sm font-medium text-foreground">{names[row.distance]}</span>
            <span aria-hidden className="hidden sm:block" />
            <Spark values={thin(row.series)} />
            <span className="flex items-baseline justify-end gap-3" data-testid="prediction-time">
              <span className="min-w-[72px] text-right text-[15px] font-semibold leading-none text-foreground sm:min-w-0">{formatDuration(Math.round(row.seconds))}</span>
              {/* Slower is the caution; faster is good news, by the one delta rule. */}
              {/* One line, signed (v5.5 #21): "33 s / slower" wrapped, and the
                  header already says "change in 12 weeks". A fixed width, so
                  the times above and below line up. */}
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
        // A date, not a warning: muted, as every caption (v4.17).
        <span className="pt-1.5 text-xs text-muted-foreground" data-testid="predictions-race">
          {s.race(names[race.distance]!)}
          {bare(race.date)} · {s.inDays(race.daysUntil)}
        </span>
      )}
    </Card>
  )
}

/** The least air above and below the lines, in s/km; 5% of their range when that is more (v4.17.3). */
export const PACE_PAD_MIN = 5
const PACE_PAD_SHARE = 0.05
/** The domain's limits land on a multiple of this many seconds. */
const PACE_ROUND = 5

/**
 * The pace chart's domain and its three y labels (v4.17.3): the drawn paces
 * - the smoothed lines, not the raw weeks, whose outliers left the lines in
 * the top half - with 5% of their range either side, at least 5 s/km,
 * rounded out to 5 s. The labels are its two edges and its middle, so every
 * drawn pace sits between two labelled lines; the domain grows by 5 s when
 * needed to keep the middle on a 5 s pace. Faster is up.
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

/** A pace sentence part with its figure in bold, coloured by what the change means. */
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
      {/* Three paces up the left (v4.17.2), outside the scrub so a touch
          still reads the week under it; higher is faster. The outer two sit
          on the chart's edges, so a little room above and below for them. */}
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

function EfficiencyCard({ allWeeks, weeks, end, onShift }: { allWeeks: WeeklyTrendPoint[]; weeks: WeeklyTrendPoint[]; end: string; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.efficiency
  const view = efficiencyView(allWeeks, weeks, end)
  if (!view) return null
  const rpe = rpeView(allWeeks, end)
  const values = [...view.adjusted, ...view.measured].filter((v): v is number => v !== null)
  const min = Math.min(...values) - 0.05
  const max = Math.max(...values) + 0.05
  const W = 1000
  const H = 80
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

/** A band's colour by what its loss means: the best band pos, over 10 s warn, the rest muted. */
export function heatColor(row: { best: boolean; cost: number | null }): string {
  if (row.best) return 'var(--pos)'
  return row.cost !== null && row.cost > HEAT_WARN_SEC ? 'var(--warn)' : 'var(--muted-foreground)'
}

/**
 * Heat cost, redesigned (v4.17): each band's bar is the seconds a km it loses
 * against your best temperature band at the same heart rate. The best band
 * is the zero the others are measured from: a dot at the track's start and
 * "best" in pos. A band without runs has a dashed, empty track - drawn like
 * the best band's, it read as the best (design review, Oct 2026) - and a
 * line under the rows says what a bar's length is.
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
      <div className="mb-1 flex flex-col gap-1">
        {view.warm === null ? <Sentence>{s.noWarm}</Sentence> : view.warm.hi < 5 ? <Sentence>{s.little}</Sentence> : <BoldSentence parts={s.lose(range!)} />}
        {/* The cold costs pace too, and the card used to say nothing about
            it (App Fixes 2b). */}
        {view.cold !== null && view.cold >= COST_WORTH_SAYING && <BoldSentence parts={s.cold(view.cold)} />}
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
}

export function PerformanceTab({ window, period, onShift, today, weeks, vo2max, threshold, predictions, race, heat }: PerformanceTabProps) {
  const inWindow = weeksIn(weeks, window)
  const easy = paceShift(inWindow, (w) => w.easyPace)
  const workout = paceShift(inWindow, (w) => w.hardPace)
  return (
    <div className="flex flex-col gap-3.5">
      <SummaryStrip vo2={vo2View(window.live ? vo2max.value : null, vo2max.samples, window.live ? today : window.end)} threshold={thresholdShift(threshold, window)} easy={easy} />
      <PredictionsCard days={predictions} window={window} period={period} race={window.live ? race : null} />
      <PaceTrendCard weeks={inWindow} easy={easy} workout={workout} onShift={onShift} />
      <EfficiencyCard allWeeks={weeks} weeks={inWindow} end={window.end} onShift={onShift} />
      <HeatCostCard data={heat} />
    </div>
  )
}
