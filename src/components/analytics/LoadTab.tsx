'use client'

import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { FormBand } from '@/domain/training/formBand'
import { SAFE_RATIO_HI, SAFE_RATIO_LO } from '@/domain/training/loadTrend'
import { formatDate, formatDecimal, MINUS } from '@/lib/formatters'
import { TRAINING_STATUS_COLORS } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { deltaTone, DELTA_TONE_COLOR } from '@/lib/deltaTone'
import type { StatTone } from '@/components/ui/Stat'
import { t } from '@/i18n'
import { Card, CardHead, ChartScrub, Legend, LegendItem, Sentence, windowLabels } from './AnalyticsKit'
import { loadTrendView, loadTrendYMax, recoveryView } from './loadRecoveryView'
import { LoadFocusCard } from './LoadFocusCard'
import type { AnalyticsBoardData } from './AnalyticsClient'
import { formView, statusView, type DayWindow, type LoadDay, type LoadPeriod, type StatusDay } from './analyticsView'

/**
 * At the Training status cells' strength, set on the card as --form-fill: full-strength Fresh bars would be the
 * loudest thing on the tab.
 */
const formFill = (band: string) => `color-mix(in srgb, var(--form-band-fill-${band}) var(--form-fill), transparent)`
export const FORM_FILL: Record<FormBand, string> = {
  veryFresh: formFill('fresh'),
  fresh: formFill('fresh'),
  neutral: formFill('neutral'),
  tired: formFill('tired'),
}
export const FORM_FILL_STRENGTH = '[--form-fill:70%] dark:[--form-fill:60%]'

/** Very fresh is caution again: fitness starts to slip. */
const FORM_TONE: Record<FormBand, StatTone> = { tired: 'warn', neutral: 'muted', fresh: 'pos', veryFresh: 'warn' }

const signed = (n: number) => (n < 0 ? `${MINUS}${Math.abs(n)}` : n > 0 ? `+${n}` : '0')

export { windowLabels }

const STATUS_COLOR = TRAINING_STATUS_COLORS
const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

/** The strip and its legend, lighter than today's full-strength cell. */
export function statusTint(status: keyof typeof STATUS_COLOR): string {
  return `color-mix(in srgb, ${STATUS_COLOR[status]} 60%, transparent)`
}

/** The status card's span, as its caption names it. */
const STATUS_SPAN: Record<LoadPeriod, 'days28' | 'weeks12' | 'months12'> = { '4w': 'days28', '12w': 'weeks12', '1y': 'months12' }

function StatusCard({
  days,
  window,
  period,
  onShift,
  estimated,
}: {
  days: StatusDay[]
  window: DayWindow
  period: LoadPeriod
  onShift: (step: 1 | -1) => void
  estimated: boolean
}) {
  const s = t.analytics.cards.status
  const names = t.trainingStatus.status
  const view = statusView(days, window)
  if (!view) return null
  const cells = view.cells
  return (
    <Card testId="status-card">
      <CardHead
        title={s.title}
        caption={(estimated ? s.captionEstimated : s.caption)((window.live ? s.spanLive : s.span)[STATUS_SPAN[period]])}
        about={estimated ? s.aboutEstimated : s.about}
      />
      <Sentence>
        <b>{names[view.current]}</b>
        {window.live ? s.sentenceToday(view.count, view.days) : s.sentenceOn(bare(window.end), view.count, view.days)}
      </Sentence>
      <ChartScrub count={cells.length} onShift={onShift} readout={(i) => `${bare(cells[i]!.date)} · ${cells[i]!.status ? names[cells[i]!.status!] : '–'}`}>
        <div className="grid h-[22px] gap-[3px]" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }} data-testid="training-status-strip">
          {cells.map((cell, i) => {
            const today = window.live && i === cells.length - 1
            return (
              <div
                key={cell.date}
                className={cn('rounded-[4px]', today && 'state-today')}
                data-today={today || undefined}
                style={{
                  // Today alone at full strength, in the shared today ring: a heavy ink outline reads as a different mark.
                  background: cell.status ? (today ? STATUS_COLOR[cell.status] : statusTint(cell.status)) : 'var(--track)',
                }}
              />
            )
          })}
        </div>
      </ChartScrub>
      {/* Each count right after its name: spread across the card, a count reads as the next item's. */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" data-testid="status-legend">
        {view.totals.map(({ status, days: n }) => (
          <span key={status} className="flex items-center gap-1.5" data-testid="status-legend-item">
            <LegendItem swatch="square" color={statusTint(status)}>{names[status]}</LegendItem>
            <b className="font-semibold text-foreground">{s.days(n)}</b>
          </span>
        ))}
      </div>
    </Card>
  )
}

export interface LoadTabProps {
  window: DayWindow
  period: LoadPeriod
  onShift: (step: 1 | -1) => void
  today: string
  data: AnalyticsBoardData
}

const WARN = 'var(--warn)'

/** A move as an arrow and its size: ↗ 6, ↘ 23, → 0. */
function Move({ delta, metric, decimals = 0 }: { delta: number; metric: 'fitness' | 'fatigue'; decimals?: number }) {
  const r = decimals ? Math.round(delta * 10) / 10 : Math.round(delta)
  const Arrow = r > 0 ? ArrowUpRight : r < 0 ? ArrowDownRight : ArrowRight
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums" style={{ color: DELTA_TONE_COLOR[deltaTone(metric, r)] }}>
      <Arrow size={12} strokeWidth={1.8} aria-hidden />
      {decimals ? formatDecimal(Math.abs(r), decimals) : Math.abs(r)}
    </span>
  )
}

function LoadCard({
  pairs,
  load,
  window,
  yMax,
  estimated,
}: {
  pairs: AnalyticsBoardData['loads']
  load: LoadDay[]
  window: DayWindow
  yMax: number
  estimated: boolean
}) {
  const s = t.analytics.cards.loadCompact
  const view = loadTrendView(pairs, window, yMax)
  if (!view) return null
  const form = formView(load, window)
  const ctl = form?.ctl ?? []
  const ramp = ctl.length > 7 ? ctl[ctl.length - 1]! - ctl[ctl.length - 8]! : null
  const out = view.state !== 'in'
  const ratioOut = view.ratio < SAFE_RATIO_LO || view.ratio > SAFE_RATIO_HI
  const W = 320
  const H = 72
  const pts = view.points
  // The domain is what is drawn, 10 % either side: from zero, the line and its band sit in the chart's top half.
  const lowest = Math.min(...pts.map((p) => Math.min(p.acute, p.lo)))
  const highest = Math.max(...pts.map((p) => Math.max(p.acute, p.hi)))
  const pad = Math.max(1, (highest - lowest) * 0.1)
  const x = (i: number) => (pts.length > 1 ? (i / (pts.length - 1)) * W : W / 2)
  const y = (v: number) => H - ((v - lowest + pad) / (highest - lowest + 2 * pad)) * H
  const band = `${pts.map((p, i) => `${x(i)},${y(p.hi)}`).join(' ')} ${[...pts].reverse().map((p, i) => `${x(pts.length - 1 - i)},${y(p.lo)}`).join(' ')}`
  return (
    <Card testId="load-card">
      <CardHead title={s.title} caption={s.caption} about={estimated ? t.analytics.cards.loadTrend.aboutEstimated : t.analytics.cards.loadTrend.about} />
      <div className="grid grid-cols-3 gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[22px] font-bold leading-tight tabular-nums" style={{ color: out ? WARN : undefined }} data-testid="load-trend-value" data-state={view.state}>
            {view.acute}
          </span>
          <span className="text-[11.5px] text-muted-foreground">{s.safe(view.lo, view.hi)}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[22px] font-bold leading-tight tabular-nums" style={{ color: ratioOut ? WARN : undefined }} data-testid="load-ratio">
            {formatDecimal(view.ratio, 2)}
          </span>
          <span className="text-[11.5px] text-muted-foreground">{t.analytics.cards.loadTrend.ratioSafe(SAFE_RATIO_LO, SAFE_RATIO_HI)}</span>
        </div>
        {ramp !== null && (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 text-[22px] font-bold leading-tight tabular-nums" style={{ color: ramp < 0 ? WARN : undefined }} data-testid="fitness-ramp">
              {ramp > 0 ? <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden /> : ramp < 0 ? <ArrowDownRight size={14} strokeWidth={1.8} aria-hidden /> : null}
              {formatDecimal(Math.abs(ramp), 1)}
            </span>
            <span className="text-[11.5px] text-muted-foreground">{s.fitnessWeek}</span>
          </div>
        )}
      </div>
      {/* The chart sets its height; the out-of-range dots lie over it. */}
      <div className="relative">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden data-testid="load-mini">
          <polygon points={band} fill="color-mix(in srgb, var(--accent) 8%, transparent)" />
          <polyline points={pts.map((p, i) => `${x(i)},${y(p.hi)}`).join(' ')} fill="none" stroke="color-mix(in srgb, var(--accent) 40%, transparent)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <polyline points={pts.map((p, i) => `${x(i)},${y(p.lo)}`).join(' ')} fill="none" stroke="color-mix(in srgb, var(--accent) 40%, transparent)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <polyline points={pts.map((p, i) => `${x(i)},${y(p.acute)}`).join(' ')} fill="none" stroke="var(--foreground)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute inset-0" aria-hidden>
          {pts.map((p, i) =>
            p.out && i >= pts.length - 3 ? (
              <span key={p.date} className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(x(i) / W) * 100}%`, top: y(p.acute), background: WARN }} />
            ) : null,
          )}
        </div>
      </div>
    </Card>
  )
}

function FormCard({ load, nights, window, period }: { load: LoadDay[]; nights: AnalyticsBoardData['recovery']; window: DayWindow; period: LoadPeriod }) {
  const s = t.analytics.cards.form
  const view = formView(load, window)
  if (!view) return null
  const rhr = recoveryView(nights, window)?.restingHr ?? null
  const bars = view.bars
  const scale = Math.max(10, ...bars.map((b) => Math.abs(b.form)))
  void period
  return (
    <Card className={cn('gap-2', FORM_FILL_STRENGTH)} testId="form-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-[22px] font-bold tabular-nums" data-testid="form-value" style={{ color: FORM_TONE[view.band] === 'warn' ? WARN : undefined }}>
          {signed(view.form)} <span className="text-xs font-normal text-muted-foreground">{t.formBand[view.band].toLocaleLowerCase(t.locale)}</span>
        </span>
        <span className="text-xs text-[var(--text-2)]">
          {s.fitness} {view.fitness} <span data-testid="fitness-delta"><Move metric="fitness" delta={view.fitnessDelta} /></span>
        </span>
        <span className="text-xs text-[var(--text-2)]">
          {s.fatigue} {view.fatigue} <span data-testid="fatigue-delta"><Move metric="fatigue" delta={view.fatigueDelta} /></span>
        </span>
      </div>
      <div className="flex h-[22px] items-center" style={{ gap: bars.length > 30 ? 1 : 2 }} data-testid="form-strip">
        {bars.map((bar) => (
          <span
            key={bar.date}
            data-band={bar.band}
            className="min-w-0 flex-1 rounded-[2px]"
            style={{ height: `${Math.max(14, (Math.abs(bar.form) / scale) * 100)}%`, background: FORM_FILL[bar.band] }}
          />
        ))}
      </div>
      <Legend className="gap-x-3">
        <LegendItem swatch="square" color={FORM_FILL.fresh}>{s.legend.fresh}</LegendItem>
        <LegendItem swatch="square" color={FORM_FILL.neutral}>{s.legend.neutral}</LegendItem>
        <LegendItem swatch="square" color={FORM_FILL.tired}>{s.legend.tired}</LegendItem>
      </Legend>
      {rhr && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-[12.5px]" data-testid="form-rhr">
          <span className="text-[var(--text-2)]">
            {t.analytics.cards.loadCompact.restingHr} <b className="font-semibold text-foreground">{rhr.now}</b> · {t.analytics.cards.loadCompact.baseline(rhr.side, rhr.lo, rhr.hi)}
          </span>
          <span style={{ color: rhr.side ? WARN : DELTA_TONE_COLOR.good }}>{rhr.side ? t.analytics.cards.loadCompact.check : t.analytics.cards.loadCompact.ok}</span>
        </div>
      )}
    </Card>
  )
}

export function LoadTab({ window, period, onShift, today, data }: LoadTabProps) {
  const yMax = loadTrendYMax(data.loads, today)
  return (
    <div className="flex flex-col gap-3.5">
      <LoadCard pairs={data.loads} load={data.load} window={window} yMax={yMax} estimated={data.estimated.loads} />
      <FormCard load={data.load} nights={data.recovery} window={window} period={period} />
      {/* The watch's own status as its chart, not a sentence in the coach card. */}
      <StatusCard days={data.status} window={window} period={period} onShift={onShift} estimated={data.estimated.status} />
      {/* The sync keeps only the latest balance, so a window back in time has none. */}
      {window.live && <LoadFocusCard balance={data.balance} today={today} />}
    </div>
  )
}
