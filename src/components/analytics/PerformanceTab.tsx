'use client'

import type { WeeklyTrendPoint } from '@/application/usecases/GetAnalyticsData'
import type { HeatImpactData } from '@/application/usecases/GetHeatImpact'
import { formatClock, formatCountdown, formatDate, formatDeltaFixed, formatDuration, MINUS } from '@/lib/formatters'
import { t } from '@/i18n'
import { AxisLabels, BoldSentence, Card, CardHead, ChartScrub, Headline, Legend, LegendItem, Sentence, linePath } from './AnalyticsKit'
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

/** "9 s slower", "28 s faster", or "1:10 slower" once it is past a minute. */
export function shiftWords(delta: number | null): string | null {
  const s = t.analytics.cards.summary
  if (delta === null) return null
  const abs = Math.abs(Math.round(delta))
  if (abs === 0) return s.same
  const amount = abs >= 60 ? formatDuration(abs) : s.secs(abs)
  return delta > 0 ? s.slower(amount) : s.faster(amount)
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

function SummaryStrip({ vo2, threshold, easy }: { vo2: ReturnType<typeof vo2View>; threshold: PaceShift | null; easy: PaceShift | null }) {
  const s = t.analytics.cards.summary
  const cells = [
    vo2 && {
      label: s.vo2max,
      value: vo2.value.toFixed(1),
      note: vo2.delta === null ? null : vo2.delta === 0 ? s.noChange12w : s.in12w(vo2.delta > 0 ? `+${vo2.delta}` : `${MINUS}${Math.abs(vo2.delta)}`),
    },
    threshold && { label: s.threshold, value: formatClock(threshold.now), note: shiftWords(threshold.delta) },
    easy && { label: s.easyPace, value: formatClock(easy.now), note: shiftWords(easy.delta) },
  ].filter((c): c is { label: string; value: string; note: string | null } => !!c)
  if (!cells.length) return null
  return (
    <section className="grid rounded-card border border-[var(--divider)] bg-card" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }} data-testid="performance-summary">
      {cells.map((c, i) => (
        <div key={c.label} className="flex flex-col gap-1 p-3.5" style={i < cells.length - 1 ? { borderRight: '1px solid var(--divider)' } : undefined}>
          <span className="text-caption uppercase tracking-[0.08em] text-muted-foreground">{c.label}</span>
          <span className="font-display text-[22px] font-bold leading-none tabular-nums text-foreground">{c.value}</span>
          {c.note && <span className="text-caption text-muted-foreground">{c.note}</span>}
        </div>
      ))}
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
    <svg width="100%" height="22" viewBox="0 0 100 22" preserveAspectRatio="none" className="block" aria-hidden>
      <path d={linePath(values.map((v) => -v), -(max + pad), -(min - pad), 100, 22)} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
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
  const range = trend && 'lo' in trend ? (trend.unit === 'min' ? s.minutes(trend.lo, trend.hi) : s.seconds(trend.lo, trend.hi)) : ''
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
    <Card testId="predictions-card">
      <CardHead title={s.title} caption={s.caption(t.analytics.cards.period.caption[period]!)} about={s.about} />
      {(lead || goal) && <Sentence testId="predictions-sentence">{[lead, goal].filter(Boolean).join(' ')}</Sentence>}
      <div className="flex flex-col">
        {rows.map((row) => (
          <div key={row.distance} className="grid grid-cols-[62px_minmax(0,1fr)_70px_60px] items-center gap-2.5 border-t border-[var(--divider)] py-2.5" data-testid={`prediction-${row.distance}`}>
            <span className="text-[14px] font-semibold text-foreground">{names[row.distance]}</span>
            <Spark values={thin(row.series)} />
            <span className="text-right font-display text-[16px] font-bold leading-none tabular-nums text-foreground">{formatDuration(Math.round(row.seconds))}</span>
            {/* Slower is the caution; faster stays quiet, not accent (v4.6). */}
            <span
              className="text-right text-[12px] leading-tight"
              style={{ color: row.delta !== null && row.delta >= 1 ? 'var(--tone-caution)' : 'var(--muted-foreground)' }}
              data-testid="prediction-delta"
            >
              {shiftWords(row.delta) ?? ''}
            </span>
          </div>
        ))}
      </div>
      {race && (
        <span className="text-[12px] text-muted-foreground">
          {race.targetSeconds ? s.target(names[race.distance]!) : s.race(names[race.distance]!)}
          <span className="font-bold text-[var(--tone-caution)]">
            {bare(race.date)} · {formatCountdown(race.daysUntil)}
          </span>
        </span>
      )}
    </Card>
  )
}

const PACE_STEP = 40

function PaceTrendCard({ weeks, easy, workout, onShift }: { weeks: WeeklyTrendPoint[]; easy: PaceShift | null; workout: PaceShift | null; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.paceTrend
  const paces = [...weeks.map((w) => w.easyPace), ...weeks.map((w) => w.hardPace)].filter((v): v is number => v !== null)
  if (!easy || paces.length < 2) return null
  const lo = Math.floor(Math.min(...paces) / PACE_STEP) * PACE_STEP
  const hi = Math.max(lo + PACE_STEP * 3, Math.ceil(Math.max(...paces) / PACE_STEP) * PACE_STEP)
  const ticks = Array.from({ length: Math.round((hi - lo) / PACE_STEP) + 1 }, (_, i) => lo + i * PACE_STEP)
  const W = 280
  const H = 120
  // Faster is up: the axis runs from the slowest pace at the bottom.
  const path = (pick: (w: WeeklyTrendPoint) => number | null) => linePath(smooth(weeks.map(pick)).map((v) => (v === null ? null : -v)), -hi, -lo, W, H)
  const shift = easy.delta === null || Math.abs(easy.delta) < 1 ? null : easy.delta
  const easyParts = shift === null ? s.easyHeld : shift < 0 ? s.easyFaster(`${Math.abs(shift)} s`) : s.easySlower(`${shift} s`)
  const wShift = workout?.delta ?? null
  const workoutLine = wShift === null ? '' : Math.abs(wShift) < 5 ? s.workoutHeld : wShift < 0 ? s.workoutFaster(`${Math.abs(wShift)} s`) : s.workoutSlower(`${wShift} s`)
  return (
    <Card testId="pace-trend-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <BoldSentence parts={[easyParts[0], easyParts[1], `${easyParts[2]}${workoutLine}`]} />
      <div className="grid grid-cols-[minmax(0,1fr)_30px] gap-1.5">
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
            {ticks.map((_, i) => (
              <line key={i} x1="0" x2={W} y1={(H * i) / (ticks.length - 1)} y2={(H * i) / (ticks.length - 1)} stroke="var(--divider)" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={path((w) => w.hardPace)} fill="none" stroke="var(--zone-4)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
            <path d={path((w) => w.easyPace)} fill="none" stroke="var(--zone-2)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
          </svg>
        </ChartScrub>
        <div className="-my-[5px] flex flex-col justify-between text-caption leading-none text-muted-foreground" aria-hidden>
          {ticks.map((tick) => (
            <span key={tick}>{formatClock(tick)}</span>
          ))}
        </div>
      </div>
      <AxisLabels labels={timeLabels(weeks.map((w) => w.date))} className="pr-9" />
      <Legend className="gap-x-4 text-[12px]">
        <LegendItem swatch="dot" color="var(--zone-2)"><span className="font-semibold text-foreground">{s.easy} {formatClock(easy.now)}</span></LegendItem>
        {workout && <LegendItem swatch="dot" color="var(--zone-4)"><span className="font-semibold text-foreground">{s.workout} {formatClock(workout.now)}</span></LegendItem>}
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
  const W = 311
  const H = 90
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
      <Headline value={view.now.toFixed(2)} note={view.delta4w !== null || view.delta12w !== null ? s.deltas(d(view.delta4w), d(view.delta12w)) : undefined} />
      <Sentence>{sentence}</Sentence>
      <ChartScrub
        count={view.dates.length}
        mode="line"
        onShift={onShift}
        readout={(i) => [t.analytics.cards.scrubWeek(bare(view.dates[i]!)), view.adjusted[i] != null && `${s.adjusted} ${view.adjusted[i]!.toFixed(2)}`].filter(Boolean).join(' · ')}
      >
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--divider)" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={W} y1={H} y2={H} stroke="var(--divider)" vectorEffect="non-scaling-stroke" />
          <path d={linePath(smooth(view.measured), min, max, W, H)} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.6" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <path d={linePath(smooth(view.adjusted), min, max, W, H)} fill="none" stroke="var(--foreground)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
        </svg>
      </ChartScrub>
      <Legend className="gap-x-4 text-[12px]">
        <LegendItem swatch="line" color="var(--foreground)">{s.adjusted}</LegendItem>
        <LegendItem swatch="dash" color="var(--muted-foreground)">{s.measured}</LegendItem>
      </Legend>
      {rpe && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-t border-[var(--divider)] pt-3" data-testid="rpe-row">
          <div className="flex flex-col gap-[3px]">
            <span className="text-[14px] font-semibold text-foreground">{s.rpe}</span>
            <span className="text-[12px] text-muted-foreground">{s.rpeLine(rpe.avg.toFixed(1), s.rpeTrend[rpe.trend]!)}</span>
          </div>
          <div className="flex h-[26px] items-end gap-[3px]" aria-hidden>
            {rpe.bars.map((v, i) => (
              <div key={i} className="w-[7px] rounded-[2px]" style={{ height: v === null ? 2 : Math.max(2, (v / rpeMax) * 24), background: i === rpe.bars.length - 1 ? 'var(--foreground)' : 'var(--band)' }} />
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function HeatCostCard({ data }: { data: HeatImpactData | null }) {
  const s = t.analytics.cards.heatCost
  const view = heatView(data)
  if (!view) return null
  const labels = t.analytics.charts.heatImpact.bands
  const range = view.warm ? (view.warm.lo === view.warm.hi ? `${view.warm.hi}` : `${view.warm.lo}–${view.warm.hi}`) : null
  return (
    <Card testId="heat-card">
      <CardHead title={s.title} caption={s.caption(view.refHeartRate)} about={s.about} />
      {view.warm === null ? <Sentence>{s.noWarm}</Sentence> : view.warm.hi < 5 ? <Sentence>{s.little}</Sentence> : <BoldSentence parts={s.lose(range!)} />}
      <div className="flex flex-col gap-[9px]">
        {view.rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[58px_minmax(0,1fr)_84px] items-center gap-2.5 text-[13px]" data-testid={`heat-${row.id}`}>
            <span className="text-muted-foreground">{labels[row.id]?.replace('-', '–')}</span>
            <div className="relative h-3.5 rounded-[4px] bg-[var(--track)]">
              {row.cost !== null && (
                <div
                  className="absolute inset-y-0 left-0 rounded-[4px]"
                  style={{
                    // Bars are the neutral comparison grey; the best band, the
                    // reference, is a short ink tick (v4.6: no accent here).
                    width: row.best ? 3 : `${(row.cost / view.scale) * 100}%`,
                    background: row.best ? 'var(--foreground)' : 'var(--series-2)',
                  }}
                />
              )}
            </div>
            <span className="text-right tabular-nums text-foreground">
              {row.pace === null ? (
                <>
                  <b>—</b> <span className="text-muted-foreground">{s.noRuns}</span>
                </>
              ) : (
                <>
                  <b>{formatClock(row.pace)}</b> <span className="text-muted-foreground">{row.best ? s.best : s.plus(row.cost!)}</span>
                </>
              )}
            </span>
          </div>
        ))}
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
    <div className="flex flex-col gap-3">
      <SummaryStrip vo2={vo2View(window.live ? vo2max.value : null, vo2max.samples, window.live ? today : window.end)} threshold={thresholdShift(threshold, window)} easy={easy} />
      <PredictionsCard days={predictions} window={window} period={period} race={window.live ? race : null} />
      <PaceTrendCard weeks={inWindow} easy={easy} workout={workout} onShift={onShift} />
      <EfficiencyCard allWeeks={weeks} weeks={inWindow} end={window.end} onShift={onShift} />
      <HeatCostCard data={heat} />
    </div>
  )
}
