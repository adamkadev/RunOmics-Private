'use client'

import { useState } from 'react'
import type { LoadRiskPanel } from '@/application/usecases/GetLoadRiskPanel'
import type { FormBand } from '@/domain/training/formBand'
import { formatDate, formatDecimal, formatNumber, MINUS } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { deltaTone } from '@/lib/deltaTone'
import { TRAINING_STATUS_COLORS } from '@/lib/colors'
import { Stat, StatGrid, type StatTone } from '@/components/ui/Stat'
import { RangeBar } from '@/components/ui/RangeBar'
import { t } from '@/i18n'
import { AxisLabels, Card, CardHead, ChartScrub, Legend, LegendItem, STAT_TONE, Sentence, linePath, windowLabels } from './AnalyticsKit'
import { LoadTrendCard, RecoveryCard } from './LoadRecoveryCards'
import { loadTrendYMax } from './loadRecoveryView'
import type { AnalyticsBoardData } from './AnalyticsClient'
import { formView, riskRows, statusView, type DayWindow, type LoadDay, type LoadPeriod, type RiskRow, type StatusDay } from './analyticsView'

/** Garmin's statuses as cells, in the one status map (lib/colors). */
const STATUS_COLOR = TRAINING_STATUS_COLORS

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
const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

export { windowLabels }

/** Half the strip's height: bars go up for fresh days and down for tired ones. */
const FORM_HALF = 28

function FormCard({ load, window, period, onShift }: { load: LoadDay[]; window: DayWindow; period: LoadPeriod; onShift: (step: 1 | -1) => void }) {
  const s = t.analytics.cards.form
  const view = formView(load, window)
  if (!view) return null
  const W = 1000
  const H = 110
  const bars = view.bars
  const words = t.analytics.cards.period.words[period]!
  // The strip fills its height with the window's largest swing, never less
  // than 10: a window of near-zero days stays near the line.
  const scale = Math.max(10, ...bars.map((b) => Math.abs(b.form)))
  return (
    <Card className={cn('gap-3.5', FORM_FILL_STRENGTH)} testId="form-card">
      <CardHead title={s.title} caption={s.caption} about={s.about} />
      <StatGrid columns={3} className="gap-3 sm:gap-4">
        <Stat size="lg" label={s.title} value={signed(view.form)} meaning={`${t.formBand[view.band]} · ${s.range[view.band]}`} tone={FORM_TONE[view.band]} />
        <Stat
          size="lg"
          label={<LegendItem swatch="line" color="var(--foreground)">{s.fitness}</LegendItem>}
          value={view.fitness}
          meaning={<span data-testid="fitness-delta">{s.inPeriod(signed(view.fitnessDelta), words)}</span>}
          tone={STAT_TONE[deltaTone('fitness', view.fitnessDelta)]}
        />
        <Stat
          size="lg"
          label={<LegendItem swatch="dash" color="var(--muted-foreground)">{s.fatigue}</LegendItem>}
          value={view.fatigue}
          meaning={<span data-testid="fatigue-delta">{s.inPeriod(signed(view.fatigueDelta), words)}</span>}
          tone={STAT_TONE[deltaTone('fatigue', view.fatigueDelta)]}
        />
      </StatGrid>
      <ChartScrub
        count={view.dates.length}
        mode="line"
        onShift={onShift}
        readout={(i) => `${bare(view.dates[i]!)} · ${s.fitness} ${Math.round(view.ctl[i]!)} · ${s.fatigue} ${Math.round(view.atl[i]!)}`}
      >
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block overflow-visible" aria-hidden>
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--divider)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={linePath(view.atl, 0, view.yMax, W, H)} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          <path d={linePath(view.ctl, 0, view.yMax, W, H)} fill="none" stroke="var(--foreground)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </ChartScrub>
      <div className="flex flex-col gap-2.5">
        <ChartScrub count={bars.length} onShift={onShift} readout={(i) => `${bare(bars[i]!.date)} · ${s.title} ${signed(bars[i]!.form)}`}>
          {/* Diverging bars (v4.17): up from the middle for a fresh day, down
              for a tired one, each in its band's status colour. */}
          <div className="flex" style={{ height: FORM_HALF * 2, gap: bars.length > 30 ? 1 : 3 }} data-testid="form-strip">
            {bars.map((bar) => {
              const h = Math.max(1.5, (Math.abs(bar.form) / scale) * FORM_HALF)
              const fill = <div data-band={bar.band} className="w-full" style={{ height: h, background: FORM_FILL[bar.band] }} />
              return (
                <div key={bar.date} className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-end [&>div]:rounded-t-[2px]" style={{ height: FORM_HALF }}>{bar.form > 0 && fill}</div>
                  <div className="flex items-start [&>div]:rounded-b-[2px]" style={{ height: FORM_HALF }}>{bar.form <= 0 && fill}</div>
                </div>
              )
            })}
          </div>
        </ChartScrub>
        <AxisLabels labels={windowLabels(view.dates, window.live)} />
        <Legend className="gap-x-4">
          <LegendItem swatch="square" color={FORM_FILL.fresh}>{s.legend.fresh}</LegendItem>
          <LegendItem swatch="square" color={FORM_FILL.neutral}>{s.legend.neutral}</LegendItem>
          <LegendItem swatch="square" color={FORM_FILL.tired}>{s.legend.tired}</LegendItem>
        </Legend>
      </div>
    </Card>
  )
}

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

const RISK_DECIMALS: Record<RiskRow['key'], number> = { loadRatio: 2, monotony: 1, rampRate: 1 }
/** In range the value is text ink; out of it caution, past the alert limit bad (v4.17: never a zone). */
const RISK_INK: Record<RiskRow['state'], string> = { ok: 'var(--foreground)', out: 'var(--warn)', alert: 'var(--neg)' }

function riskValue(row: RiskRow): string {
  const text = formatDecimal(row.value, RISK_DECIMALS[row.key])
  if (row.key !== 'rampRate') return text
  return row.value > 0 ? `+${text}` : row.value < 0 ? `${MINUS}${formatDecimal(Math.abs(row.value), 1)}` : text
}

function edgeLabel(row: RiskRow, v: number): string {
  if (row.key !== 'rampRate') return formatDecimal(v, 1)
  return v > 0 ? `+${formatNumber(v)}` : v < 0 ? `${MINUS}${formatNumber(Math.abs(v))}` : '0'
}

/** The safe range under its bar: "Safe 0.8 – 1.3", "Safe below 2.0", "Safe −5 to +5". */
export function safeCaption(row: RiskRow): string {
  const s = t.analytics.cards.risk
  if (!row.labelLo) return s.safeBelow(edgeLabel(row, row.hi))
  return row.lo < 0 ? s.safeSigned(edgeLabel(row, row.lo), edgeLabel(row, row.hi)) : s.safeBetween(edgeLabel(row, row.lo), edgeLabel(row, row.hi))
}

function RiskRowView({ row, risk }: { row: RiskRow; risk: LoadRiskPanel }) {
  const s = t.analytics.cards.risk
  const [formula, setFormula] = useState(false)
  const at = (v: number) => (v - row.min) / (row.max - row.min)
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
  return (
    <div className="flex flex-col gap-2 border-t border-border py-2.5" data-testid={`risk-${row.key}`} data-state={row.state}>
      <div className="flex items-baseline justify-between gap-3">
        <button type="button" onClick={() => setFormula((v) => !v)} aria-expanded={formula} className="min-w-0 text-left text-sm text-foreground">
          <span className="font-medium">{name}</span>{' '}
          <span className="text-xs text-muted-foreground" data-testid={row.key === 'loadRatio' ? 'load-ratio-inputs' : undefined}>{hint}</span>
        </button>
        <span className="shrink-0 text-lg font-semibold leading-none" style={{ color: RISK_INK[row.state] }} data-testid="risk-value">
          {riskValue(row)}
        </span>
      </div>
      {formula && <p className="text-xs leading-snug text-muted-foreground">{explain}</p>}
      <RangeBar
        band={[at(row.lo), at(row.hi)]}
        marker={at(row.value)}
        markerColor={RISK_INK[row.state]}
        caption={safeCaption(row)}
        label={`${name} ${riskValue(row)}, ${safeCaption(row)}`}
      />
    </div>
  )
}

function RiskCard({ risk }: { risk: LoadRiskPanel | null }) {
  const s = t.analytics.cards.risk
  const rows = riskRows(risk)
  if (!risk || !rows.length) return null
  const ok = rows.filter((r) => r.state === 'ok').length
  // The count says what it means: all in range is good news, any past its
  // alert limit bad, anything else caution.
  const tone = ok === rows.length ? 'var(--pos)' : rows.some((r) => r.state === 'alert') ? 'var(--neg)' : 'var(--warn)'
  return (
    <Card className="gap-1.5" testId="risk-card">
      <div className="pb-1.5">
        <CardHead
          title={s.title}
          about={s.about}
          right={
            <span className="shrink-0 text-xs" style={{ color: tone }} data-testid="risk-count">
              {s.inRange(ok, rows.length)}
            </span>
          }
        />
      </div>
      <div className="flex flex-col">
        {rows.map((row) => (
          <RiskRowView key={row.key} row={row} risk={risk} />
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

export function LoadTab({ window, period, onShift, today, data }: LoadTabProps) {
  // Load trend and the Load ratio share one acute/chronic series and one y
  // range per athlete (v5.4).
  const yMax = loadTrendYMax(data.loads, today)
  return (
    <div className="flex flex-col gap-3.5">
      <FormCard load={data.load} window={window} period={period} onShift={onShift} />
      <LoadTrendCard pairs={data.loads} window={window} yMax={yMax} onShift={onShift} />
      <RiskCard risk={data.risk} />
      <RecoveryCard nights={data.recovery} window={window} />
      <StatusCard days={data.status} window={window} period={period} onShift={onShift} />
    </div>
  )
}
