'use client'

import type { LoadPair } from '@/domain/training/loadTrend'
import type { RecoveryNight } from '@/domain/training/recovery'
import { formatDate, MINUS } from '@/lib/formatters'
import { DELTA_TONE_COLOR } from '@/lib/deltaTone'
import { Stat, StatGrid } from '@/components/ui/Stat'
import { t } from '@/i18n'
import { AxisLabels, BoldSentence, Card, CardHead, ChartScrub, Headline, Legend, LegendItem, STAT_TONE, linePath, windowLabels } from './AnalyticsKit'
import type { DayWindow } from './analyticsView'
import {
  loadTrendView,
  recoveryView,
  type LoadTrendView,
  type RecoverySeries,
  type RecoveryView,
} from './loadRecoveryView'

/**
 * The two Load cards (v5.4, v4.17). Lines are text ink over a band in the
 * pos status's tint - the range that is good for you; warn marks the points
 * outside it. Four colours and no others: --foreground, --muted-foreground,
 * --pos (the band) and --warn, plus the delta rule's own through deltaTone.
 */
const INK = 'var(--foreground)'
const MUTED = 'var(--muted-foreground)'
const SAFE_BAND = 'color-mix(in srgb, var(--pos) 14%, transparent)'
const BASELINE_BAND = 'color-mix(in srgb, var(--pos) 12%, transparent)'
const LEGEND_BAND = 'color-mix(in srgb, var(--pos) 20%, transparent)'
const WARN = 'var(--warn)'

const W = 1000
const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

/** A point's place on the chart, in percent of its box. */
const at = (i: number, n: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100)
const heightPct = (v: number, min: number, max: number) => (1 - (v - min) / (max - min || 1)) * 100

/** A point outside its range: a 7 pt warn dot, HTML over the SVG so it stays round on a stretched chart. */
function OutsideDot({ left, top, today }: { left: number; top: number; today?: boolean }) {
  return (
    <span
      aria-hidden
      data-testid={today ? 'today-dot' : 'outside-dot'}
      className="pointer-events-none absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{ left: `${left}%`, top: `${top}%`, background: WARN }}
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

export function LoadTrendCard({ pairs, window, yMax, onShift }: { pairs: LoadPair[]; window: DayWindow; yMax: number; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.loadTrend
  const view = loadTrendView(pairs, window, yMax)
  if (!view) return null
  const H = 140
  const { points } = view
  const n = points.length
  const out = view.state !== 'in'
  return (
    <Card testId="load-trend-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        {/* Outside the range the number itself is the caution. */}
        <span className="text-[26px] font-semibold leading-tight" style={{ color: out ? WARN : INK }} data-testid="load-trend-value" data-state={view.state}>
          {view.acute}
        </span>
        <span className="text-[13px]" style={{ color: MUTED }}>{s.safe(view.lo, view.hi)}</span>
      </div>
      <BoldSentence parts={loadSentence(view, window.live)} />
      <ChartScrub
        count={n}
        mode="line"
        onShift={onShift}
        readout={(i) => s.readout(bare(points[i]!.date), points[i]!.acute, points[i]!.lo, points[i]!.hi)}
      >
        <div className="relative" style={{ height: H }}>
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
            <path d={bandPath(points.map((p) => p.lo), points.map((p) => p.hi), 0, yMax, H)} fill={SAFE_BAND} data-testid="safe-band" />
            <path d={linePath(points.map((p) => p.acute), 0, yMax, W, H)} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {points.map((p, i) => {
            const today = window.live && i === n - 1
            // Today outside the band is still a point outside it (v4.17: no
            // accent "now" dot; the axis says Today).
            const outside = today ? out : p.out
            return outside ? <OutsideDot key={p.date} left={at(i, n)} top={heightPct(p.acute, 0, yMax)} today={today} /> : null
          })}
        </div>
      </ChartScrub>
      <div className="flex flex-col gap-2.5">
        <AxisLabels labels={windowLabels(points.map((p) => p.date), window.live)} />
        <Legend className="gap-x-4">
          <LegendItem swatch="line" color={INK}>{s.legend.acute}</LegendItem>
          <LegendItem swatch="square" color={LEGEND_BAND}>{s.legend.safe}</LegendItem>
          <LegendItem swatch="dot" color={WARN}>{s.legend.outside}</LegendItem>
        </Legend>
      </div>
    </Card>
  )
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${MINUS}${Math.abs(n)}` : '0')

function deltaWords(series: RecoverySeries): string {
  const s = t.analytics.cards.recovery
  return series.delta === null || series.delta === 0 ? s.noChange : s.vsWeek(signed(series.delta))
}

export function recoverySentence(view: RecoveryView): readonly [string, string, string] {
  const s = t.analytics.cards.recovery
  const { hrv, restingHr: rhr } = view
  if (!view.out) {
    if (hrv && rhr) return s.bothInside
    // One series: its baseline in the sentence, as the chart has no label row.
    const one = (hrv ?? rhr)!
    return s.insideBaseline(one.lo, one.hi, hrv ? s.ms : s.bpm)
  }
  const rhrUp = rhr && rhr.delta !== null && rhr.delta > 0 ? rhr.delta : null
  if (hrv?.side) {
    const and = !rhr?.side ? '' : rhr.side === 'high' ? (rhrUp ? s.andRhrUp(rhrUp) : s.andRhrHigh) : s.andRhrLow
    return [s.hrvLead, hrv.side === 'low' ? s.hrvLow(view.hrvLowStreak) : s.hrvHigh, `${and}${s.takeEasy}`]
  }
  const bold = rhr!.side === 'high' ? (rhrUp ? s.rhrUpBold(rhrUp) : s.rhrHighBold) : s.rhrLowBold
  return [s.rhrLead, bold, s.takeEasy]
}

function MiniChart({ label, series, dates, height, live, unit, testId }: { label?: string; series: RecoverySeries; dates: string[]; height: number; live: boolean; unit: string; testId: string }) {
  const s = t.analytics.cards.recovery
  const { values, yMin, yMax } = series
  const n = values.length
  const last = values.findLastIndex((v) => v !== null)
  const y = (v: number) => height - ((v - yMin) / (yMax - yMin || 1)) * height
  return (
    <div className="flex flex-col gap-1.5" data-testid={testId}>
      {label && (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="font-medium" style={{ color: INK }}>{label}</span>
          <span style={{ color: MUTED }}>{s.baseline(series.lo, series.hi)}</span>
        </div>
      )}
      <ChartScrub
        count={n}
        mode="line"
        readout={(i) => (values[i] === null ? bare(dates[i]!) : s.readout(bare(dates[i]!), values[i]!, unit))}
      >
        <div className="relative" style={{ height }}>
          <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
            <rect x="0" width={W} y={y(series.hi)} height={Math.max(1, y(series.lo) - y(series.hi))} fill={BASELINE_BAND} data-testid="baseline-band" />
            <path d={linePath(values, yMin, yMax, W, height)} fill="none" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          {values.map((v, i) =>
            v !== null && series.outside[i] ? <OutsideDot key={i} left={at(i, n)} top={heightPct(v, yMin, yMax)} today={live && i === last} /> : null,
          )}
        </div>
      </ChartScrub>
    </div>
  )
}

export function RecoveryCard({ nights, window }: { nights: RecoveryNight[]; window: DayWindow }) {
  const s = t.analytics.cards.recovery
  const view = recoveryView(nights, window)
  if (!view) return null
  const { hrv, restingHr: rhr } = view
  const both = !!hrv && !!rhr
  const one = hrv ?? rhr!
  return (
    <Card testId="recovery-card">
      <CardHead title={s.title} caption={both ? s.caption : hrv ? s.captionHrv : s.captionDaily} about={s.about} />
      {both ? (
        <StatGrid columns={2}>
          <div data-testid="recovery-hrv">
            <Stat size="lg" label={s.hrv} value={hrv.now} unit={s.ms} meaning={<span data-tone={hrv.tone}>{deltaWords(hrv)}</span>} tone={STAT_TONE[hrv.tone]} />
          </div>
          <div data-testid="recovery-rhr">
            <Stat size="lg" label={s.restingHr} value={rhr.now} unit={s.bpm} meaning={<span data-tone={rhr.tone}>{deltaWords(rhr)}</span>} tone={STAT_TONE[rhr.tone]} />
          </div>
        </StatGrid>
      ) : (
        // One series (v4.17): the card names it, so the value and its change
        // sit on one line.
        <div data-testid={hrv ? 'recovery-hrv' : 'recovery-rhr'}>
          <Headline
            value={one.now}
            unit={hrv ? s.ms : s.bpm}
            note={<span data-tone={one.tone}>{deltaWords(one)}</span>}
            noteStyle={{ color: DELTA_TONE_COLOR[one.tone] }}
          />
        </div>
      )}
      <BoldSentence parts={recoverySentence(view)} />
      {hrv && (
        <MiniChart label={both ? s.hrv : undefined} unit={s.ms} series={hrv} dates={view.dates} height={both ? 64 : 80} live={window.live} testId="recovery-hrv-chart" />
      )}
      {rhr && (
        <MiniChart label={both ? s.restingHr : undefined} unit={s.bpm} series={rhr} dates={view.dates} height={both ? 44 : 80} live={window.live} testId="recovery-rhr-chart" />
      )}
      <AxisLabels labels={windowLabels(view.dates, window.live)} />
    </Card>
  )
}
