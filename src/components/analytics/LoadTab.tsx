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
import type { AnalyticsBoardData } from './AnalyticsClient'
import { formView, statusView, type DayWindow, type LoadDay, type LoadPeriod, type StatusDay } from './analyticsView'

/**
 * Form's bars and their legend (v4.17): Fresh pos, Neutral line-2, Tired
 * warn, at the Training status cells' strength (v4.17.3) - the full #7bd64a
 * Fresh bars were the loudest thing on the tab. 60% in dark, 70% in light,
 * set on the card as --form-fill; the zero line and the labels keep full
 * contrast.
 */
const formFill = (band: string) => `color-mix(in srgb, var(--form-band-fill-${band}) var(--form-fill), transparent)`
export const FORM_FILL: Record<FormBand, string> = {
  veryFresh: formFill('fresh'),
  fresh: formFill('fresh'),
  neutral: formFill('neutral'),
  tired: formFill('tired'),
}
export const FORM_FILL_STRENGTH = '[--form-fill:70%] dark:[--form-fill:60%]'

/**
 * What Form's band means: tired is caution, fresh good news, and very fresh
 * caution again - fitness starts to slip - as its token (--form-band-very-fresh).
 */
const FORM_TONE: Record<FormBand, StatTone> = { tired: 'warn', neutral: 'muted', fresh: 'pos', veryFresh: 'warn' }

const signed = (n: number) => (n < 0 ? `${MINUS}${Math.abs(n)}` : n > 0 ? `+${n}` : '0')

export { windowLabels }

/** Garmin's statuses as cells, in the one status map (lib/colors). */
const STATUS_COLOR = TRAINING_STATUS_COLORS
const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

/** A status cell's fill at 60% (v4.17.2): the strip, and its legend, lighter than today's cell. */
export function statusTint(status: keyof typeof STATUS_COLOR): string {
  return `color-mix(in srgb, ${STATUS_COLOR[status]} 60%, transparent)`
}

/** The status card's span, as its caption names it. */
const STATUS_SPAN: Record<LoadPeriod, 'days28' | 'weeks12' | 'months12'> = { '4w': 'days28', '12w': 'weeks12', '1y': 'months12' }

function StatusCard({ days, window, period, onShift }: { days: StatusDay[]; window: DayWindow; period: LoadPeriod; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.status
  const names = t.trainingStatus.status
  const view = statusView(days, window)
  if (!view) return null
  const cells = view.cells
  return (
    <Card testId="status-card">
      <CardHead title={s.title} caption={s.caption((window.live ? s.spanLive : s.span)[STATUS_SPAN[period]])} about={s.about} />
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
                className="rounded-[4px]"
                data-today={today || undefined}
                style={{
                  // The strip at 60% so the card reads lighter (v4.17.2);
                  // today alone at full strength, outlined in text ink.
                  background: cell.status ? (today ? STATUS_COLOR[cell.status] : statusTint(cell.status)) : 'var(--track)',
                  outline: today ? '2px solid var(--foreground)' : undefined,
                  outlineOffset: 1,
                }}
              />
            )
          })}
        </div>
      </ChartScrub>
      {/* Each count right after its name (v4.17.2), the items 20 px apart:
          spread across the card, a count read as the next item's. */}
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

/** A move as an arrow and its size: ↗ 6, ↘ 23, → 0 (rule 04). */
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

/**
 * Load, compact (App Fixes 2a): the seven-day load, the ratio and fitness a
 * week, each amber while it is out of range, over a 40 px line of acute load
 * against its safe band.
 */
function LoadCard({ pairs, load, window, yMax }: { pairs: AnalyticsBoardData['loads']; load: LoadDay[]; window: DayWindow; yMax: number }) {
  const s = t.analytics.cards.loadCompact
  const view = loadTrendView(pairs, window, yMax)
  if (!view) return null
  const form = formView(load, window)
  const ctl = form?.ctl ?? []
  const ramp = ctl.length > 7 ? ctl[ctl.length - 1]! - ctl[ctl.length - 8]! : null
  const out = view.state !== 'in'
  const ratioOut = view.ratio < SAFE_RATIO_LO || view.ratio > SAFE_RATIO_HI
  const W = 320
  const H = 40
  const pts = view.points
  const top = Math.max(1, ...pts.map((p) => Math.max(p.acute, p.hi))) * 1.1
  const x = (i: number) => (pts.length > 1 ? (i / (pts.length - 1)) * W : W / 2)
  const y = (v: number) => H - (v / top) * H
  const band = `${pts.map((p, i) => `${x(i)},${y(p.hi)}`).join(' ')} ${[...pts].reverse().map((p, i) => `${x(pts.length - 1 - i)},${y(p.lo)}`).join(' ')}`
  return (
    <Card className="gap-2.5" testId="load-card">
      <CardHead title={s.title} caption={s.caption} about={t.analytics.cards.loadTrend.about} />
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
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden data-testid="load-mini">
        <polygon points={band} fill="color-mix(in srgb, var(--accent) 8%, transparent)" />
        <polyline points={pts.map((p, i) => `${x(i)},${y(p.hi)}`).join(' ')} fill="none" stroke="color-mix(in srgb, var(--accent) 40%, transparent)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <polyline points={pts.map((p, i) => `${x(i)},${y(p.lo)}`).join(' ')} fill="none" stroke="color-mix(in srgb, var(--accent) 40%, transparent)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <polyline points={pts.map((p, i) => `${x(i)},${y(p.acute)}`).join(' ')} fill="none" stroke="var(--foreground)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative -mt-[46px] h-10" aria-hidden>
        {pts.map((p, i) =>
          p.out && i >= pts.length - 3 ? (
            <span key={p.date} className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(x(i) / W) * 100}%`, top: y(p.acute), background: WARN }} />
          ) : null,
        )}
      </div>
    </Card>
  )
}

/**
 * Form, compact (App Fixes 2a): one line - form, fitness and fatigue with
 * their moves - a daily strip in the three band colours, and resting HR
 * against its baseline in a divider row.
 */
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

/**
 * The Load tab, compact (App Fixes 2a): the coach card above it, then Load
 * and Form, then the watch's Training status. Injury risk and the large
 * Load trend are gone; what they argued is in the coach's "Why ›".
 */
export function LoadTab({ window, period, onShift, today, data }: LoadTabProps) {
  const yMax = loadTrendYMax(data.loads, today)
  return (
    <div className="flex flex-col gap-3.5">
      <LoadCard pairs={data.loads} load={data.load} window={window} yMax={yMax} />
      <FormCard load={data.load} nights={data.recovery} window={window} period={period} />
      {/* The watch's own status as its chart, not a sentence in the coach card (owner, Oct 2026). */}
      <StatusCard days={data.status} window={window} period={period} onShift={onShift} />
    </div>
  )
}
