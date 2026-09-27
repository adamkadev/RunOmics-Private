'use client'

import { useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight } from 'lucide-react'
import type { LoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import type { TrainingStatusType } from '@/domain/training/status'
import type { FormBand } from '@/domain/training/formBand'
import { formatClock, formatDate, formatDelta, formatDeltaFixed, MINUS } from '@/lib/formatters'
import { deltaColor } from '@/lib/deltaTone'
import { t } from '@/i18n'
import { AxisLabels, Card, CardHead, ChartScrub, Legend, LegendItem, Sentence, Sheet, linePath, windowLabels } from './AnalyticsKit'
import { LoadTrendCard, RecoveryCard } from './LoadRecoveryCards'
import { loadCoachHeadline, loadTrendView, loadTrendYMax, recoveryView, type LoadCoachHeadline } from './loadRecoveryView'
import type { AnalyticsBoardData } from './AnalyticsClient'
import {
  coachRead,
  dayWindow,
  efficiencyView,
  formView,
  paceShift,
  predictionRows,
  riskRows,
  statusView,
  weeksIn,
  type CoachReadView,
  type DayWindow,
  type LoadDay,
  type RiskRow,
  type StatusDay,
  type Trend,
} from './analyticsView'

/** Garmin's statuses as cells: the name stays ink, the cell carries the hue. */
export const STATUS_COLOR: Record<TrainingStatusType, string> = {
  productive: 'var(--zone-3)',
  overreaching: 'var(--zone-5)',
  detraining: 'var(--series-3)',
  recovery: 'var(--zone-2)',
  fresh: 'var(--zone-1)',
  maintaining: 'var(--band)',
  unproductive: 'var(--tone-caution)',
}

/** Form's strip: fresh Z2, neutral the band grey, tired amber. */
export const FORM_FILL: Record<FormBand, string> = {
  veryFresh: 'var(--form-band-fill-fresh)',
  fresh: 'var(--form-band-fill-fresh)',
  neutral: 'var(--form-band-fill-neutral)',
  tired: 'var(--form-band-fill-tired)',
}

const signed = (n: number) => (n < 0 ? `${MINUS}${Math.abs(n)}` : n > 0 ? `+${n}` : '0')
const arrow = (n: number) => (n > 0 ? `↑${n}` : n < 0 ? `↓${Math.abs(n)}` : '±0')
const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

export { windowLabels }

/** What the coach read's sentences say, from the numbers the cards print. */
/** The load headline's words (v5.4), first match of load and recovery. */
export function loadHeadlineText(h: LoadCoachHeadline): string {
  const s = t.analytics.cards.coachRead.load
  const span = t.analytics.cards.loadTrend.span
  switch (h.kind) {
    case 'spikeAndDip':
      return s.spikeAndDip
    case 'spike':
      return h.change ? s.spike(h.change.pct, span(h.change.days)) : s.spikeAbove
    case 'dip':
      return s.dip
    case 'building':
      return h.recovery ? s.building(h.change.pct, span(h.change.days)) : s.buildingLoad(h.change.pct, span(h.change.days))
  }
}

export function coachText(view: CoachReadView, load: LoadCoachHeadline | null = null): { headline: string; signals: { trend: Trend; text: string }[] } {
  const s = t.analytics.cards.coachRead
  const headline = load
    ? loadHeadlineText(load)
    : view.tone === 'positive' ? s.headline.positive : view.tone === 'neutral' ? s.headline.neutral : view.loadUp ? s.headline.cautionLoadUp : s.headline.caution
  const signals = view.signals.map((signal) => {
    switch (signal.key) {
      case 'easy': {
        const pace = formatClock(signal.pace)
        // The Easy pace tile's own words: "1 s faster" is 1 s faster here too,
        // even where the arrow calls a second flat.
        const text = signal.delta === 0 ? s.easyLevel(pace) : signal.delta < 0 ? s.easyFaster(pace, Math.abs(signal.delta)) : s.easySlower(pace, signal.delta)
        return { trend: signal.trend, text }
      }
      case 'predictions': {
        const text =
          signal.trend === 'declining' ? s.predictionsSlower(signal.slower, signal.count) : signal.trend === 'improving' ? s.predictionsFaster(signal.faster, signal.count) : s.predictionsHeld
        return { trend: signal.trend, text }
      }
      case 'efficiency':
        return { trend: signal.trend, text: s.efficiency(signal.value.toFixed(2), formatDeltaFixed(signal.delta, 2)) }
      case 'volume':
        return { trend: signal.trend, text: s.volume(formatDelta(Math.round(signal.delta))) }
    }
  })
  return { headline, signals }
}

/** A trend's arrow: never the accent, because a trend delta is not "now" (v4.3 §3). */
const TREND_ICON: Record<Trend, { Icon: typeof ArrowRight; color: string }> = {
  improving: { Icon: ArrowUpRight, color: 'var(--muted-foreground)' },
  flat: { Icon: ArrowRight, color: 'var(--muted-foreground)' },
  declining: { Icon: ArrowDownRight, color: 'var(--tone-caution)' },
}

function CoachRead({ view, load }: { view: CoachReadView; load: LoadCoachHeadline | null }) {
  const s = t.analytics.cards.coachRead
  const [open, setOpen] = useState(false)
  const text = coachText(view, load)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${s.eyebrow}: ${s.open}`}
        data-testid="coach-read"
        data-tone={view.tone}
        data-load={load?.kind}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 rounded-card border border-[var(--divider)] bg-card px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-caption font-bold uppercase tracking-[0.1em] text-muted-foreground">{s.eyebrow}</span>
        <ChevronRight size={16} className="row-span-2 text-muted-foreground" aria-hidden />
        <span className="font-display text-[16px] font-semibold leading-[1.3] text-foreground text-pretty">{text.headline}</span>
      </button>
      {open && (
        <Sheet title={s.sheetTitle} onClose={() => setOpen(false)}>
          <ul className="flex flex-col gap-3">
            {text.signals.map((signal, i) => {
              const { Icon, color } = TREND_ICON[signal.trend]
              return (
                <li key={i} className="flex items-start gap-2.5 text-[15px] leading-snug text-foreground" data-trend={signal.trend}>
                  <Icon size={16} strokeWidth={2.4} className="mt-0.5 shrink-0" style={{ color }} aria-hidden />
                  {signal.text}
                </li>
              )
            })}
          </ul>
        </Sheet>
      )}
    </>
  )
}

function FormCard({ load, window, onShift }: { load: LoadDay[]; window: DayWindow; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.form
  const view = formView(load, window)
  if (!view) return null
  const W = 311
  const H = 110
  const bars = view.bars
  return (
    <Card testId="form-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <div className="flex items-end gap-[18px]">
        <div className="flex flex-col gap-1">
          <span className="font-display text-[40px] font-bold leading-none tabular-nums text-foreground">{signed(view.form)}</span>
          <span className="text-[13px] font-semibold text-foreground">
            {t.formBand[view.band]} <span className="font-normal text-muted-foreground">· {s.range[view.band]}</span>
          </span>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 pb-0.5">
          {[
            { label: s.fitness, value: view.fitness, delta: view.fitnessDelta, metric: 'fitness' as const, swatch: 'line' as const, color: 'var(--foreground)' },
            { label: s.fatigue, value: view.fatigue, delta: view.fatigueDelta, metric: 'fatigue' as const, swatch: 'dash' as const, color: 'var(--muted-foreground)' },
          ].map((m) => (
            <div key={m.label} className="flex flex-col gap-[3px]">
              <span className="text-[12px] text-muted-foreground">
                <LegendItem swatch={m.swatch} color={m.color}>{m.label}</LegendItem>
              </span>
              <span className="font-display text-[18px] font-bold leading-none tabular-nums text-foreground">
                {m.value}{' '}
                <span className="font-sans text-[12px] font-medium" style={{ color: deltaColor(m.metric, m.delta) }} data-testid={`${m.metric}-delta`}>
                  {arrow(m.delta)}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <ChartScrub
        count={view.dates.length}
        mode="line"
        onShift={onShift}
        readout={(i) => `${bare(view.dates[i]!)} · ${s.fitness} ${Math.round(view.ctl[i]!)} · ${s.fatigue} ${Math.round(view.atl[i]!)}`}
      >
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
          {[1, 2, 3].map((k) => (
            <line key={k} x1="0" x2={W} y1={(H * k) / 3} y2={(H * k) / 3} stroke="var(--divider)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={linePath(view.atl, 0, view.yMax, W, H)} fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <path d={linePath(view.ctl, 0, view.yMax, W, H)} fill="none" stroke="var(--foreground)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute -top-0.5 right-0 text-caption leading-none text-muted-foreground">{view.yMax}</span>
      </ChartScrub>
      <div className="flex flex-col gap-1">
        <ChartScrub count={bars.length} onShift={onShift} readout={(i) => `${bare(bars[i]!.date)} · ${s.title} ${signed(bars[i]!.form)}`}>
          <div className="relative flex h-11 gap-0.5 border-t border-dashed border-[var(--divider)]" data-testid="form-strip">
            <div className="absolute inset-x-0 top-[22px] h-px bg-[var(--band)]" />
            {bars.map((bar, i) => {
              const h = Math.min(22, Math.abs(bar.form) * 0.8) || 1
              const today = window.live && i === bars.length - 1
              return (
                <div key={bar.date} className="relative flex-1">
                  <div
                    data-band={bar.band}
                    className="absolute inset-x-0 rounded-[1px]"
                    style={{ top: bar.form >= 0 ? 22 - h : 22, height: h, background: FORM_FILL[bar.band], boxShadow: today ? '0 0 0 1.5px var(--foreground)' : undefined }}
                  />
                </div>
              )
            })}
          </div>
        </ChartScrub>
        <AxisLabels labels={windowLabels(view.dates, window.live)} />
        <Legend className="gap-x-3 pt-1">
          <LegendItem swatch="square" color={FORM_FILL.fresh}>{s.legend.fresh}</LegendItem>
          <LegendItem swatch="square" color={FORM_FILL.neutral}>{s.legend.neutral}</LegendItem>
          <LegendItem swatch="square" color={FORM_FILL.tired}>{s.legend.tired}</LegendItem>
        </Legend>
      </div>
    </Card>
  )
}

function StatusCard({ days, window, onShift }: { days: StatusDay[]; window: DayWindow; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.status
  const names = t.trainingStatus.status
  const view = statusView(days, window)
  if (!view) return null
  const cells = view.cells
  return (
    <Card testId="status-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <Sentence>
        <b>{names[view.current]}</b>
        {window.live ? s.sentenceToday(view.count, view.days) : s.sentenceOn(bare(window.end), view.count, view.days)}
      </Sentence>
      <ChartScrub count={cells.length} onShift={onShift} readout={(i) => `${bare(cells[i]!.date)} · ${cells[i]!.status ? names[cells[i]!.status!] : '–'}`}>
        <div className="grid h-[22px] gap-0.5" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }} data-testid="training-status-strip">
          {cells.map((cell, i) => (
            <div
              key={cell.date}
              className="rounded-[3px]"
              style={{
                background: cell.status ? STATUS_COLOR[cell.status] : 'var(--track)',
                boxShadow: window.live && i === cells.length - 1 ? '0 0 0 1.5px var(--foreground)' : undefined,
              }}
            />
          ))}
        </div>
      </ChartScrub>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] text-foreground">
        {view.totals.map(({ status, days: n }) => (
          <span key={status} className="flex justify-between gap-2">
            <LegendItem swatch="square" color={STATUS_COLOR[status]}>{names[status]}</LegendItem>
            <b className="tabular-nums">{s.days(n)}</b>
          </span>
        ))}
      </div>
    </Card>
  )
}

const RISK_DECIMALS: Record<RiskRow['key'], number> = { loadRatio: 2, monotony: 1, rampRate: 1 }
const RISK_INK: Record<RiskRow['state'], string> = { ok: 'var(--foreground)', out: 'var(--tone-caution)', alert: 'var(--zone-5)' }

function riskValue(row: RiskRow): string {
  const text = row.value.toFixed(RISK_DECIMALS[row.key])
  if (row.key !== 'rampRate') return text
  return row.value > 0 ? `+${text}` : row.value < 0 ? `${MINUS}${Math.abs(row.value).toFixed(1)}` : text
}

function edgeLabel(row: RiskRow, v: number): string {
  if (row.key === 'loadRatio') return v.toFixed(1)
  if (row.key === 'monotony') return v.toFixed(1)
  return v > 0 ? `+${v}` : v < 0 ? `${MINUS}${Math.abs(v)}` : '0'
}

function RiskRowView({ row, risk }: { row: RiskRow; risk: LoadRiskPanel }) {
  const s = t.analytics.cards.risk
  const [formula, setFormula] = useState(false)
  const pos = (v: number) => `${((Math.min(row.max, Math.max(row.min, v)) - row.min) / (row.max - row.min)) * 100}%`
  const name = s[row.key]
  // The ratio prints its inputs, the last point of Load trend (v5.4).
  const hint =
    row.key === 'loadRatio'
      ? risk.acute !== null && risk.chronic !== null
        ? `${risk.acute} ÷ ${risk.chronic}`
        : s.loadRatioHint
      : row.key === 'monotony'
        ? s.monotonyHint
        : s.rampRateHint
  const explain =
    row.key === 'loadRatio'
      ? risk.acute !== null && risk.chronic !== null
        ? s.loadRatioFormula(risk.acute, risk.chronic)
        : s.loadRatioFormulaLocal
      : row.key === 'monotony'
        ? s.monotonyFormula
        : s.rampRateFormula
  const ink = RISK_INK[row.state]
  return (
    <div className="flex flex-col gap-[7px]" data-testid={`risk-${row.key}`} data-state={row.state}>
      <div className="flex items-baseline justify-between gap-3">
        <button type="button" onClick={() => setFormula((v) => !v)} aria-expanded={formula} className="min-w-0 text-left text-[14px] font-semibold text-foreground">
          {name} <span className="text-[12px] font-normal tabular-nums text-muted-foreground" data-testid={row.key === 'loadRatio' ? 'load-ratio-inputs' : undefined}>{hint}</span>
        </button>
        <span className="font-display text-[18px] font-bold leading-none tabular-nums" style={{ color: ink }}>{riskValue(row)}</span>
      </div>
      {formula && <p className="text-[12px] leading-snug text-muted-foreground">{explain}</p>}
      <div className="relative h-1.5 rounded-[3px] bg-[var(--track)]">
        <div className="absolute inset-y-0 bg-[var(--band)]" style={{ left: pos(row.lo), width: `calc(${pos(row.hi)} - ${pos(row.lo)})` }} />
        <div className="absolute -top-1 h-3.5 w-1 rounded-[2px]" style={{ left: `calc(${pos(row.value)} - 2px)`, background: ink }} data-testid="risk-marker" />
      </div>
      <div className="relative h-3 text-caption leading-none text-muted-foreground" aria-hidden>
        {row.labelLo && <span className="absolute -translate-x-1/2" style={{ left: pos(row.lo) }}>{edgeLabel(row, row.lo)}</span>}
        <span className="absolute -translate-x-1/2" style={{ left: pos(row.hi) }}>{edgeLabel(row, row.hi)}</span>
      </div>
    </div>
  )
}

function RiskCard({ risk }: { risk: LoadRiskPanel | null }) {
  const s = t.analytics.cards.risk
  const rows = riskRows(risk)
  if (!risk || !rows.length) return null
  const ok = rows.filter((r) => r.state === 'ok').length
  return (
    <Card className="gap-3.5" testId="risk-card">
      <CardHead
        title={s.title}
        about={s.about}
        right={
          <span className="shrink-0 text-[13px] font-semibold text-foreground">
            {/* The accent is for "now" markers only (v4.6). */}
            {ok === rows.length && <span className="text-muted-foreground">✓ </span>}
            {s.inRange(ok, rows.length)}
          </span>
        }
      />
      {rows.map((row) => (
        <RiskRowView key={row.key} row={row} risk={risk} />
      ))}
    </Card>
  )
}

export interface LoadTabProps {
  window: DayWindow
  onShift: (step: 1 | -1) => void
  today: string
  data: AnalyticsBoardData
}

export function LoadTab({ window, onShift, today, data }: LoadTabProps) {
  // The coach read sums up the Performance and Volume cards at their
  // defaults (12 weeks, today), from the very values they print.
  const perf = dayWindow(today, '12w')
  const perfWeeks = weeksIn(data.weeks, perf)
  const ytd = data.ytd
  const coach = coachRead({
    easy: paceShift(perfWeeks, (w) => w.easyPace),
    predictions: predictionRows(data.predictions, perf),
    efficiency: efficiencyView(data.weeks, perfWeeks, perf.end),
    fitnessDelta: formView(data.load, dayWindow(today, '4w'))?.fitnessDelta ?? null,
    ytdDelta: ytd && ytd.previousToDate !== null ? (ytd.current.at(-1)?.km ?? 0) - ytd.previousToDate : null,
  })
  // Load trend, the Load ratio and the coach read share one acute/chronic
  // series and one y range per athlete (v5.4).
  const yMax = loadTrendYMax(data.loads, today)
  const loadHeadline = loadCoachHeadline(loadTrendView(data.loads, window, yMax), recoveryView(data.recovery, window))
  return (
    <div className="flex flex-col gap-3">
      {coach && <CoachRead view={coach} load={loadHeadline} />}
      <FormCard load={data.load} window={window} onShift={onShift} />
      <LoadTrendCard pairs={data.loads} window={window} yMax={yMax} onShift={onShift} />
      <RiskCard risk={data.risk} />
      <RecoveryCard nights={data.recovery} window={window} />
      <StatusCard days={data.status} window={window} onShift={onShift} />
    </div>
  )
}
