'use client'

import type { LoadPair } from '@/domain/training/loadTrend'
import type { RecoveryNight } from '@/domain/training/recovery'
import { formatDate, MINUS } from '@/lib/formatters'
import { DELTA_TONE_COLOR } from '@/lib/deltaTone'
import { t } from '@/i18n'
import { AxisLabels, BoldSentence, Card, CardHead, ChartScrub, Legend, LegendItem, linePath, windowLabels } from './AnalyticsKit'
import type { DayWindow } from './analyticsView'
import {
  loadTrendView,
  recoveryView,
  type LoadTrendView,
  type RecoverySeries,
  type RecoveryView,
} from './loadRecoveryView'

/**
 * v5.4's two Load cards. Lines are ink and bands neutral; amber only marks
 * points outside their range and the accent only today's dot. Six colours
 * and no others: --foreground, --muted-foreground, --track, --tone-caution,
 * --accent, and --good through the shared delta rule (the handoff's --tx,
 * --mu, --fa, --amb, --acc and --good).
 */
const INK = 'var(--foreground)'
const MUTED = 'var(--muted-foreground)'
const BAND = 'var(--track)'
const AMBER = 'var(--tone-caution)'
const ACCENT = 'var(--accent)'
const GRID = 'var(--divider)'

const W = 311
const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

/** A point's place on the chart, in percent of its box. */
const at = (i: number, n: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100)
const heightPct = (v: number, min: number, max: number) => (1 - (v - min) / (max - min || 1)) * 100

/** Dots are HTML over the SVG so they stay round on a stretched chart. */
function Dot({ left, top, color, today }: { left: number; top: number; color: string; today?: boolean }) {
  const size = today ? 9 : 6
  return (
    <span
      aria-hidden
      data-testid={today ? 'today-dot' : 'outside-dot'}
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, background: color, boxShadow: today ? '0 0 0 2px var(--card)' : undefined }}
    />
  )
}

/** The band as one filled shape between per-point lower and upper edges. */
function bandPath(lo: number[], hi: number[], min: number, max: number, h: number): string {
  const n = lo.length
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * h
  const top = hi.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const bottom = lo.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).reverse().join('')
  return `${top}${bottom}Z`
}

function loadSentence(view: LoadTrendView): readonly [string, string, string] {
  const s = t.analytics.cards.loadTrend
  const change = view.change
  if (view.state === 'below') return s.below
  if (view.state === 'above') return change && change.pct > 0 ? s.jumped(change.pct, s.span(change.days)) : s.above
  const parts =
    !change ? s.inRange
    : Math.abs(change.pct) < 5 ? s.steady
    : change.pct > 0 ? s.upIn(change.pct, s.span(change.days))
    : s.downIn(Math.abs(change.pct), s.span(change.days))
  // In range today, but the window had days over: say so, so the amber dots
  // under an "inside your safe range" sentence read as history (v5.5 R1).
  if (!view.over) return parts
  return [parts[0], parts[1], `${parts[2]}${s.wentOver(view.over.days, bare(view.over.last))}`]
}

export function LoadTrendCard({ pairs, window, yMax, onShift }: { pairs: LoadPair[]; window: DayWindow; yMax: number; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.loadTrend
  const view = loadTrendView(pairs, window, yMax)
  if (!view) return null
  const H = 110
  const { points } = view
  const n = points.length
  const out = view.state !== 'in'
  return (
    <Card testId="load-trend-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span
          className="font-display text-[30px] font-bold leading-none tabular-nums"
          style={{ color: out ? AMBER : INK }}
          data-testid="load-trend-value"
          data-state={view.state}
        >
          {view.acute}
        </span>
        <span className="text-[13px]" style={{ color: MUTED }}>{s.safe(view.lo, view.hi)}</span>
      </div>
      <BoldSentence parts={loadSentence(view)} />
      <ChartScrub
        count={n}
        mode="line"
        onShift={onShift}
        readout={(i) => s.readout(bare(points[i]!.date), points[i]!.acute, points[i]!.lo, points[i]!.hi)}
      >
        <div className="relative mr-8" style={{ height: H }}>
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
            {view.ticks.map((v) => (
              <line key={v} x1="0" x2={W} y1={H - (v / yMax) * H} y2={H - (v / yMax) * H} stroke={GRID} strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={bandPath(points.map((p) => p.lo), points.map((p) => p.hi), 0, yMax, H)} fill={BAND} data-testid="safe-band" />
            <path d={linePath(points.map((p) => p.acute), 0, yMax, W, H)} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {points.map((p, i) => {
            const today = window.live && i === n - 1
            if (today) return <Dot key={p.date} left={at(i, n)} top={heightPct(p.acute, 0, yMax)} color={out ? AMBER : ACCENT} today />
            return p.out ? <Dot key={p.date} left={at(i, n)} top={heightPct(p.acute, 0, yMax)} color={AMBER} /> : null
          })}
          {view.ticks.map((v) => (
            <span
              key={v}
              aria-hidden
              data-testid="load-trend-tick"
              className="absolute -right-8 w-7 -translate-y-1/2 text-right text-caption leading-none tabular-nums"
              style={{ top: `${heightPct(v, 0, yMax)}%`, color: MUTED }}
            >
              {v}
            </span>
          ))}
        </div>
      </ChartScrub>
      <div className="flex flex-col gap-1.5">
        <AxisLabels className="mr-8" labels={windowLabels(points.map((p) => p.date), window.live)} />
        <Legend className="gap-x-3 pt-1">
          <LegendItem swatch="line" color={INK}>{s.legend.acute}</LegendItem>
          <LegendItem swatch="square" color={BAND}>{s.legend.safe}</LegendItem>
          <LegendItem swatch="dot" color={AMBER}>{s.legend.outside}</LegendItem>
        </Legend>
      </div>
    </Card>
  )
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${MINUS}${Math.abs(n)}` : '0')

function RecoveryStat({ label, unit, series, testId }: { label: string; unit: string; series: RecoverySeries; testId: string }) {
  const s = t.analytics.cards.recovery
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <span className="text-caption font-semibold uppercase tracking-[0.08em]" style={{ color: MUTED }}>{label}</span>
      <span className="font-display text-[24px] font-bold leading-none tabular-nums" style={{ color: INK }}>
        {series.now} <span className="font-sans text-[13px] font-medium" style={{ color: MUTED }}>{unit}</span>
      </span>
      <span className="text-[12px] font-semibold tabular-nums" style={{ color: DELTA_TONE_COLOR[series.tone] }} data-tone={series.tone}>
        {series.delta === null || series.delta === 0 ? s.noChange : s.vsWeek(signed(series.delta))}
      </span>
    </div>
  )
}

function recoverySentence(view: RecoveryView): readonly [string, string, string] {
  const s = t.analytics.cards.recovery
  const { hrv, restingHr: rhr } = view
  if (!view.out) return hrv && rhr ? s.bothInside : hrv ? s.hrvInside : s.rhrInside
  const rhrUp = rhr && rhr.delta !== null && rhr.delta > 0 ? rhr.delta : null
  if (hrv?.side) {
    const and = !rhr?.side ? '' : rhr.side === 'high' ? (rhrUp ? s.andRhrUp(rhrUp) : s.andRhrHigh) : s.andRhrLow
    return [s.hrvLead, hrv.side === 'low' ? s.hrvLow(view.hrvLowStreak) : s.hrvHigh, `${and}${s.takeEasy}`]
  }
  const bold = rhr!.side === 'high' ? (rhrUp ? s.rhrUpBold(rhrUp) : s.rhrHighBold) : s.rhrLowBold
  return [s.rhrLead, bold, s.takeEasy]
}

function MiniChart({ label, series, dates, height, live, unit, testId }: { label: string; series: RecoverySeries; dates: string[]; height: number; live: boolean; unit: string; testId: string }) {
  const s = t.analytics.cards.recovery
  const { values, yMin, yMax } = series
  const n = values.length
  const last = values.findLastIndex((v) => v !== null)
  const y = (v: number) => height - ((v - yMin) / (yMax - yMin || 1)) * height
  return (
    <div className="flex flex-col gap-1.5" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="font-semibold" style={{ color: INK }}>{label}</span>
        <span style={{ color: MUTED }}>{s.baseline(series.lo, series.hi)}</span>
      </div>
      <ChartScrub
        count={n}
        mode="line"
        readout={(i) => (values[i] === null ? bare(dates[i]!) : s.readout(bare(dates[i]!), values[i]!, unit))}
      >
        <div className="relative" style={{ height }}>
          <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
            <rect x="0" width={W} y={y(series.hi)} height={Math.max(1, y(series.lo) - y(series.hi))} fill={BAND} />
            <path d={linePath(values, yMin, yMax, W, height)} fill="none" stroke={INK} strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {values.map((v, i) => {
            if (v === null) return null
            const today = live && i === last
            if (today) return <Dot key={i} left={at(i, n)} top={heightPct(v, yMin, yMax)} color={series.outside[i] ? AMBER : ACCENT} today />
            return series.outside[i] ? <Dot key={i} left={at(i, n)} top={heightPct(v, yMin, yMax)} color={AMBER} /> : null
          })}
        </div>
      </ChartScrub>
    </div>
  )
}

export function RecoveryCard({ nights, window }: { nights: RecoveryNight[]; window: DayWindow }) {
  const s = t.analytics.cards.recovery
  const view = recoveryView(nights, window)
  if (!view) return null
  return (
    <Card testId="recovery-card">
      <CardHead title={s.title} caption={view.hrv ? s.caption : s.captionDaily} about={s.about} />
      <div className="grid grid-cols-2 gap-3">
        {view.hrv && <RecoveryStat label={s.hrv} unit={s.ms} series={view.hrv} testId="recovery-hrv" />}
        {view.restingHr && <RecoveryStat label={s.restingHr} unit={s.bpm} series={view.restingHr} testId="recovery-rhr" />}
      </div>
      <BoldSentence parts={recoverySentence(view)} />
      {view.hrv && (
        <MiniChart label={s.hrv} unit={s.ms} series={view.hrv} dates={view.dates} height={64} live={window.live} testId="recovery-hrv-chart" />
      )}
      {view.restingHr && (
        <MiniChart label={s.restingHr} unit={s.bpm} series={view.restingHr} dates={view.dates} height={44} live={window.live} testId="recovery-rhr-chart" />
      )}
      <AxisLabels labels={windowLabels(view.dates, window.live)} />
    </Card>
  )
}
