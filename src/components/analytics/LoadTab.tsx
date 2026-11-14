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
import { loadTrendView, loadTrendYMax, overnightView, recoveryView } from './loadRecoveryView'
import { LoadFocusCard } from './LoadFocusCard'
import type { AnalyticsBoardData } from './AnalyticsClient'
import { formView, statusView, type DayWindow, type LoadDay, type LoadPeriod, type StatusDay } from './analyticsView'
import { addDays, isoDate } from '@/lib/calendarDate'

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
        {!window.live
          ? s.sentenceOn(bare(window.end), view.count, view.days)
          : view.currentDate === window.end
            ? s.sentenceToday(view.count, view.days)
            : view.currentDate === isoDate(addDays(new Date(`${window.end}T00:00:00`), -1))
              ? s.sentenceYesterday(view.count, view.days)
              : s.sentenceOnLive(bare(view.currentDate), view.count, view.days)}
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
  reprise?: boolean
}

const WARN = 'var(--warn)'

/** A move as an arrow and its size: ↗ 6, ↘ 23, → 0. */
function Move({ delta, metric, within }: { delta: number; metric: 'fitness' | 'fatigue'; within: string }) {
  const r = Math.round(delta)
  const Arrow = r > 0 ? ArrowUpRight : r < 0 ? ArrowDownRight : ArrowRight
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums" style={{ color: DELTA_TONE_COLOR[deltaTone(metric, r)] }}>
      <Arrow size={12} strokeWidth={1.8} aria-hidden />
      {Math.abs(r)} {within}
    </span>
  )
}

function LoadCard({
  pairs,
  load,
  window,
  period,
  yMax,
  estimated,
}: {
  pairs: AnalyticsBoardData['loads']
  load: LoadDay[]
  window: DayWindow
  period: LoadPeriod
  yMax: number
  estimated: boolean
}) {
  const s = t.analytics.cards.loadCompact
  const view = loadTrendView(pairs, window, yMax)
  if (!view) return null
  // The window's fitness change, the one the Form card names: a weekly slope beside it told another story.
  const form = formView(load, window)
  const ramp = form ? form.fitnessDelta : null
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
          <span className="text-[11.5px] text-muted-foreground">{t.analytics.cards.loadTrend.ratioSafe(formatDecimal(SAFE_RATIO_LO, 1), formatDecimal(SAFE_RATIO_HI, 1))}</span>
        </div>
        {ramp !== null && (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[22px] font-bold leading-tight tabular-nums" data-testid="fitness-ramp">
              {signed(ramp)}
            </span>
            <span className="text-[11.5px] text-muted-foreground">{s.fitnessIn(t.analytics.cards.form.spanShort[period])}</span>
          </div>
        )}
      </div>
      {/* The chart sets its height; the out-of-range dots lie over it. */}
      <div className="relative">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden data-testid="load-mini">
          <polygon points={band} fill="color-mix(in srgb, var(--data-done) 8%, transparent)" />
          <polyline points={pts.map((p, i) => `${x(i)},${y(p.hi)}`).join(' ')} fill="none" stroke="color-mix(in srgb, var(--data-done) 40%, transparent)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <polyline points={pts.map((p, i) => `${x(i)},${y(p.lo)}`).join(' ')} fill="none" stroke="color-mix(in srgb, var(--data-done) 40%, transparent)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
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

function FormCard({
  load,
  nights,
  tracker,
  window,
  period,
  reprise,
}: {
  load: LoadDay[]
  nights: AnalyticsBoardData['recovery']
  tracker: AnalyticsBoardData['nights']
  window: DayWindow
  period: LoadPeriod
  reprise: boolean
}) {
  const s = t.analytics.cards.form
  const view = formView(load, window)
  if (!view) return null
  const rhr = recoveryView(nights, window)?.restingHr ?? null
  const night = overnightView(tracker, window)
  const c = t.analytics.cards.loadCompact
  const bars = view.bars
  const scale = Math.max(10, ...bars.map((b) => Math.abs(b.form)))
  const within = s.within(s.spanShort[period])
  // Back from a break, both start near zero and the change would only repeat the value.
  const delta = (value: number, change: number, metric: 'fitness' | 'fatigue') =>
    reprise && change === value ? <span className="text-muted-foreground">{s.sinceReturn}</span> : <Move metric={metric} delta={change} within={within} />
  return (
    <Card className={cn('gap-2', FORM_FILL_STRENGTH)} testId="form-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-[22px] font-bold tabular-nums" data-testid="form-value" style={{ color: FORM_TONE[view.band] === 'warn' ? WARN : undefined }}>
          {signed(view.form)}
        </span>
        <span className="text-xs text-[var(--text-2)]">
          {s.fitness} {view.fitness} <span data-testid="fitness-delta">{delta(view.fitness, view.fitnessDelta, 'fitness')}</span>
        </span>
        <span className="text-xs text-[var(--text-2)]">
          {s.fatigue} {view.fatigue} <span data-testid="fatigue-delta">{delta(view.fatigue, view.fatigueDelta, 'fatigue')}</span>
        </span>
      </div>
      {/* Above the zero line fresh, below it tired: a tired day no longer reads as a tall good bar. */}
      <div className="relative flex h-[30px]" style={{ gap: bars.length > 30 ? 1 : 2 }} data-testid="form-strip">
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-[var(--line-2)]" />
        {bars.map((bar) => (
          <span key={bar.date} className="relative min-w-0 flex-1">
            <span
              data-band={bar.band}
              data-side={bar.form < 0 ? 'below' : 'above'}
              className="absolute inset-x-0 rounded-[2px]"
              style={{
                height: `max(2px, ${(Math.abs(bar.form) / scale) * 50}%)`,
                ...(bar.form < 0 ? { top: '50%' } : { bottom: '50%' }),
                background: FORM_FILL[bar.band],
              }}
            />
          </span>
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
      {night?.sleep && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-[12.5px]" data-testid="form-sleep">
          <span className="text-[var(--text-2)]">
            {c.sleep} <b className="font-semibold text-foreground">{c.duration(night.sleep.last)}</b> · {c.sleepWeek(c.duration(night.sleep.week))}
          </span>
          <span style={{ color: night.sleep.short ? WARN : DELTA_TONE_COLOR.good }}>{night.sleep.short ? c.short : c.ok}</span>
        </div>
      )}
      {night?.hrv && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-[12.5px]" data-testid="form-hrv">
          <span className="text-[var(--text-2)]">
            {c.hrv} <b className="font-semibold text-foreground">{night.hrv.now} {t.units.ms}</b> · {c.baseline(night.hrv.side, night.hrv.lo, night.hrv.hi)}
          </span>
          <span style={{ color: night.out ? WARN : DELTA_TONE_COLOR.good }}>{night.out ? c.check : c.ok}</span>
        </div>
      )}
    </Card>
  )
}

export function LoadTab({ window, period, onShift, today, data, reprise = false }: LoadTabProps) {
  const yMax = loadTrendYMax(data.loads, today)
  return (
    <div className="flex flex-col gap-3.5">
      <LoadCard pairs={data.loads} load={data.load} window={window} period={period} yMax={yMax} estimated={data.estimated.loads} />
      <FormCard load={data.load} nights={data.recovery} tracker={data.nights} window={window} period={period} reprise={reprise} />
      {/* The watch's own status as its chart, not a sentence in the coach card. */}
      <StatusCard days={data.status} window={window} period={period} onShift={onShift} estimated={data.estimated.status} />
      {/* The sync keeps only the latest balance, so a window back in time has none. */}
      {window.live && <LoadFocusCard balance={data.balance} today={today} />}
    </div>
  )
}
