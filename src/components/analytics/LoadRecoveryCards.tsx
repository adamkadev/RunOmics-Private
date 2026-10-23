'use client'

import { SAFE_RATIO_HI, SAFE_RATIO_LO, type LoadPair } from '@/domain/training/loadTrend'
import { formatDate, formatDecimal } from '@/lib/formatters'
import { t } from '@/i18n'
import { AxisLabels, BoldSentence, Card, CardHead, ChartScrub, Legend, LegendItem, linePath, windowLabels } from './AnalyticsKit'
import type { DayWindow } from './analyticsView'
import { loadTrendView, type LoadTrendView, type RecoveryView } from './loadRecoveryView'

/**
 * Load trend (v5.4, v4.17), and the sentences the coach read borrows from it
 * and from Recovery. Lines are text ink over a band in the pos status's tint -
 * the range that is good for you; warn marks the points outside it. Four
 * colours and no others: --foreground, --muted-foreground, --pos (the band)
 * and --warn.
 */
const INK = 'var(--foreground)'
const MUTED = 'var(--muted-foreground)'
const SAFE_BAND = 'color-mix(in srgb, var(--pos) 14%, transparent)'
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
  const ratioOut = view.ratio < SAFE_RATIO_LO || view.ratio > SAFE_RATIO_HI
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
      {/* The ratio reads beside the load it is made of (App Fixes 2a). Under
          Injury risk it said "risk" about a number whose low end is simply
          detraining. */}
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]" data-testid="load-ratio">
        <b className="text-sm font-semibold" style={{ color: ratioOut ? WARN : INK }}>{formatDecimal(view.ratio, 2)}</b>
        <span style={{ color: MUTED }}>{s.ratioSafe(SAFE_RATIO_LO, SAFE_RATIO_HI)}</span>
      </p>
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

/** The coach read's recovery row: resting HR against its baseline. */
export function recoverySentence(view: RecoveryView): readonly [string, string, string] {
  const s = t.analytics.cards.recovery
  const rhr = view.restingHr
  if (!view.out) return s.insideBaseline(rhr.lo, rhr.hi, s.bpm)
  const up = rhr.delta !== null && rhr.delta > 0 ? rhr.delta : null
  return [s.rhrLead, up ? s.rhrUpBold(up) : s.rhrHighBold, s.takeEasy]
}
