'use client'

import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { HeatImpactData } from '@/application/usecases/GetHeatImpact'
import { formatClock, formatDate, formatDeltaFixed, formatDuration, MINUS } from '@/lib/formatters'
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

/** The tab's stat row (v4.17): VO₂max, threshold and easy pace, each with what its change means. */
function SummaryStrip({ vo2, threshold, easy }: { vo2: ReturnType<typeof vo2View>; threshold: PaceShift | null; easy: PaceShift | null }) {
  const s = t.analytics.cards.summary
  const cells = [
    vo2 && {
      label: s.vo2max,
      value: vo2.value.toFixed(1),
      unit: undefined,
      note: vo2.delta === null ? null : vo2.delta === 0 ? s.noChange12w : s.in12w(vo2.delta > 0 ? `+${vo2.delta}` : `${MINUS}${Math.abs(vo2.delta)}`),
      tone: STAT_TONE[deltaTone('vo2max', vo2.delta)],
    },
    threshold && { label: s.threshold, value: formatClock(threshold.now), unit: t.units.perKm, note: shiftWords(threshold.delta, PACE_FLAT_SEC), tone: STAT_TONE[deltaTone('pace', threshold.delta)] },
    easy && { label: s.easyPace, value: formatClock(easy.now), unit: t.units.perKm, note: shiftWords(easy.delta, PACE_FLAT_SEC), tone: STAT_TONE[deltaTone('pace', easy.delta)] },
  ].filter((c) => !!c)
  if (!cells.length) return null
  return (
    <section className={cardClass()} data-testid="performance-summary">
      <StatGrid columns={cells.length}>
        {cells.map((c) => (
          <Stat
            key={c.label}
            size="lg"
            label={c.label}
            value={c.value}
            unit={c.unit}
            meaning={c.note && <span data-testid="summary-delta" data-tone={c.tone}>{c.note}</span>}
            tone={c.tone}
          />
        ))}
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
        ? s.slipped(who, range, words)
        : trend.kind === 'improved'
          ? s.improved(who, range, words)
          : trend.kind === 'mixed'
            ? s.mixed(trend.faster, trend.count, words)
            : s.held(who, words)
  const goalRow = race ? rows.find((r) => r.distance === race.distance) : undefined
  const gap = goalRow && race?.targetSeconds ? goalRow.seconds - race.targetSeconds : null
  const goal =
    gap !== null && race?.targetSeconds
      ? (gap > 0 ? s.offTarget : s.onTarget)(names[race.distance]!, formatDuration(Math.round(Math.abs(gap))), formatDuration(race.targetSeconds))
      : null
  return (
    <Card className="gap-2" testId="predictions-card">
      <CardHead title={s.title} caption={s.caption(words)} about={s.about} />
      {(lead || goal) && <Sentence className="mb-1.5" testId="predictions-sentence">{[lead, goal].filter(Boolean).join(' ')}</Sentence>}
      <div className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.distance}
            className="grid grid-cols-[64px_minmax(0,1fr)_72px_52px] items-center gap-3 border-t border-border py-2.5 sm:grid-cols-[90px_minmax(0,1fr)_80px_60px] sm:gap-3.5"
            data-testid={`prediction-${row.distance}`}
          >
            <span className="text-sm font-medium text-foreground">{names[row.distance]}</span>
            <Spark values={thin(row.series)} />
            <span className="text-right text-[15px] font-semibold leading-none text-foreground">{formatDuration(Math.round(row.seconds))}</span>
            {/* Slower is the caution; faster is good news, by the one delta rule. */}
            {/* One line, signed (v5.5 #21): "33 s / slower" wrapped, and the
                header already says "change in 12 weeks". */}
            <span
              className="whitespace-nowrap text-right text-xs leading-tight"
              style={{ color: deltaColor('race', row.delta, { value: row.seconds }) }}
              data-testid="prediction-delta"
            >
              {signedChange(row.delta) ?? ''}
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

const PACE_STEP = 40

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
  const paces = [...weeks.map((w) => w.easyPace), ...weeks.map((w) => w.hardPace)].filter((v): v is number => v !== null)
  if (!easy || paces.length < 2) return null
  const lo = Math.floor(Math.min(...paces) / PACE_STEP) * PACE_STEP
  const hi = Math.max(lo + PACE_STEP * 3, Math.ceil(Math.max(...paces) / PACE_STEP) * PACE_STEP)
  const W = 1000
  const H = 120
  // Faster is up: the axis runs from the slowest pace at the bottom.
  const path = (pick: (w: WeeklyTrendPoint) => number | null) => linePath(smooth(weeks.map(pick)).map((v) => (v === null ? null : -v)), -hi, -lo, W, H)
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
      <ChartScrub
        count={weeks.length}
        mode="line"
        onShift={onShift}
        readout={(i) => {
          const w = weeks[i]!
          return [t.analytics.cards.scrubWeek(bare(w.date)), w.easyPace && `${s.easy} ${formatClock(w.easyPace)}`, w.hardPace && `${s.workout} ${formatClock(w.hardPace)}`].filter(Boolean).join(' · ')
        }}
      >
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
          {[1, 2, 3].map((k) => (
            <line key={k} x1="0" x2={W} y1={(H * k) / 4} y2={(H * k) / 4} stroke="var(--divider)" vectorEffect="non-scaling-stroke" />
          ))}
          {/* Workouts Z4, easy runs Z2: the two run types' own zones. */}
          <path d={path((w) => w.hardPace)} fill="none" stroke="var(--zone-4)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d={path((w) => w.easyPace)} fill="none" stroke="var(--zone-2)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </ChartScrub>
      <AxisLabels labels={timeLabels(weeks.map((w) => w.date))} />
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
      ? `${s.dipping}${view.heatCost !== null && view.heatCost >= 0.01 ? s.dippingHeat(view.heatCost.toFixed(2)) : s.dippingNoHeat}`
      : view.trend === 'rising'
        ? s.rising
        : s.steady
  const rpeMax = Math.max(...(rpe?.bars.filter((v): v is number => v !== null) ?? [1]), 1)
  return (
    <Card testId="efficiency-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <Headline
        value={view.now.toFixed(2)}
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
        readout={(i) => [t.analytics.cards.scrubWeek(bare(view.dates[i]!)), view.adjusted[i] != null && `${s.adjusted} ${view.adjusted[i]!.toFixed(2)}`].filter(Boolean).join(' · ')}
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
            <span className="text-xs text-muted-foreground">{s.rpeLine(rpe.avg.toFixed(1), s.rpeTrend[rpe.trend]!)}</span>
          </div>
          <div className="flex h-[26px] items-end gap-[3px]" aria-hidden>
            {rpe.bars.map((v, i) => (
              <div key={i} className="w-[7px] rounded-[2px]" style={{ height: v === null ? 2 : Math.max(2, (v / rpeMax) * 24), background: i === rpe.bars.length - 1 ? 'var(--foreground)' : 'var(--line-2)' }} />
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

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
 * has no bar and reads "best" in pos.
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
        {view.warm === null ? <Sentence>{s.noWarm}</Sentence> : view.warm.hi < 5 ? <Sentence>{s.little}</Sentence> : <BoldSentence parts={s.lose(range!)} />}
      </div>
      <div className="flex flex-col gap-2.5">
        {view.rows.map((row) => {
          const color = heatColor(row)
          return (
            <div key={row.id} className="grid grid-cols-[60px_minmax(0,1fr)_96px] items-center gap-3 text-[13px] sm:grid-cols-[72px_minmax(0,1fr)_110px] sm:gap-3.5" data-testid={`heat-${row.id}`}>
              <span className="whitespace-nowrap text-[var(--text-2)]">{labels[row.id]}</span>
              <div className="h-2 rounded-full bg-[var(--surface-2)]">
                {row.cost !== null && !row.best && (
                  <div className="h-full rounded-full" style={{ width: `${Math.min(1, row.cost / view.scale) * 100}%`, background: color }} data-testid="heat-bar" />
                )}
              </div>
              <span className="whitespace-nowrap text-right">
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
