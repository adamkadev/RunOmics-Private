import type { ActivityDetailView } from './activityViews'
import type { BaselineRange, DynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { cardClass } from '@/components/ui/Card'
import { GlossaryTerm } from '@/components/ui/GlossaryTerm'
import { RangeBar, USUAL_PILL_FILL } from '@/components/ui/RangeBar'
import { formatDecimal, formatDelta } from '@/lib/formatters'
import { t } from '@/i18n'

interface Metric {
  label: string
  term: 'strideLength' | 'groundContact' | 'verticalOscillation' | 'verticalRatio'
  value: number
  display: string
  unit: string
  /** The unit a delta is written in: "pt" for a ratio's percentage points. */
  deltaUnit: string
  decimals: number
  band: BaselineRange | null
}

interface Props {
  activity: ActivityDetailView
  baseline: DynamicsBaseline | null
}

/** The ends are the 8-week range stretched to take this run; the pill is its middle half, the tick this run. */
function RangeTrack({ label, value, band, decimals, note, noteInk }: { label: string; value: number; band: BaselineRange; decimals: number; note: string | null; noteInk: string }) {
  const lo = Math.min(band.min, value)
  const hi = Math.max(band.max, value)
  const at = (v: number) => (hi > lo ? (v - lo) / (hi - lo) : 0.5)

  return (
    <div data-testid="range-track">
      <RangeBar
        label={`${label}: ${formatDecimal(value, decimals)}, ${formatDecimal(lo, decimals)}–${formatDecimal(hi, decimals)}`}
        band={[at(band.low), at(band.high)]}
        bandTone="baseline"
        marker={at(value)}
        caption={
          <div className="flex justify-between gap-3 tabular-nums">
            <span>{formatDecimal(lo, decimals)}</span>
            {note && <span className="text-center" style={{ color: noteInk }} data-testid="dynamics-delta">{note}</span>}
            <span>{formatDecimal(hi, decimals)}</span>
          </div>
        }
      />
    </div>
  )
}

const BETTER: Record<Metric['term'], 'higher' | 'lower'> = {
  strideLength: 'higher',
  groundContact: 'lower',
  verticalOscillation: 'lower',
  verticalRatio: 'lower',
}

export function deltaSentence(m: Pick<Metric, 'value' | 'band' | 'decimals' | 'deltaUnit'>): string | null {
  const d = t.activity.dynamics
  if (!m.band) return null
  const delta = Number((m.value - m.band.median).toFixed(m.decimals))
  return delta === 0 ? d.level : `${formatDelta(delta)} ${m.deltaUnit} ${d.vsUsual}`
}

export function deltaTone(m: Pick<Metric, 'value' | 'band' | 'decimals' | 'term'>): 'good' | 'worse' | 'flat' {
  if (!m.band) return 'flat'
  const delta = Number((m.value - m.band.median).toFixed(m.decimals))
  if (delta === 0) return 'flat'
  const better = BETTER[m.term] === 'higher' ? delta > 0 : delta < 0
  return better ? 'good' : 'worse'
}

const DELTA_INK: Record<'good' | 'worse' | 'flat', string> = {
  good: 'var(--good)',
  worse: 'var(--tone-caution)',
  flat: 'var(--text-2)',
}

function Legend({ weeks }: { weeks: number }) {
  const d = t.activity.dynamics
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 text-xs text-muted-foreground" data-testid="dynamics-legend">
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="h-2.5 w-4 shrink-0 rounded-full border border-accent" style={{ background: USUAL_PILL_FILL }} />
        <span className="truncate">{d.usualRange(weeks)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span aria-hidden="true" className="h-3 w-[3px] rounded-full bg-foreground" />
        {d.thisRun}
      </span>
    </div>
  )
}

export function RunningDynamics({ activity: a, baseline }: Props) {
  const d = t.activity.dynamics
  const metrics: Metric[] = []

  if (a.strideLengthM != null) {
    metrics.push({
      label: d.strideLength,
      term: 'strideLength',
      value: a.strideLengthM,
      display: formatDecimal(a.strideLengthM, 2),
      unit: t.units.m,
      deltaUnit: t.units.m,
      decimals: 2,
      band: baseline?.strideLengthM ?? null,
    })
  }
  if (a.groundContactMs != null) {
    metrics.push({
      label: d.groundContact,
      term: 'groundContact',
      value: a.groundContactMs,
      display: formatDecimal(a.groundContactMs, 0),
      unit: t.units.ms,
      deltaUnit: t.units.ms,
      decimals: 0,
      band: baseline?.groundContactMs ?? null,
    })
  }
  if (a.verticalOscillationMm != null) {
    metrics.push({
      label: d.vertOscillation,
      term: 'verticalOscillation',
      value: a.verticalOscillationMm,
      display: formatDecimal(a.verticalOscillationMm, 1),
      unit: t.units.mm,
      deltaUnit: t.units.mm,
      decimals: 1,
      band: baseline?.verticalOscillationMm ?? null,
    })
  }
  if (a.verticalRatioPct != null) {
    metrics.push({
      label: d.vertRatio,
      term: 'verticalRatio',
      value: a.verticalRatioPct,
      display: formatDecimal(a.verticalRatioPct, 1),
      unit: t.units.percent,
      deltaUnit: d.ratioUnit,
      decimals: 1,
      band: baseline?.verticalRatioPct ?? null,
    })
  }

  if (!metrics.length) return null

  return (
    <section className={cardClass({ padding: 'none', className: 'px-5 py-1.5' })} data-testid="running-dynamics">
      {metrics.some((m) => m.band) && baseline && <Legend weeks={baseline.weeks} />}
      {metrics.map((m) => {
        const sentence = deltaSentence(m)
        const ink = DELTA_INK[deltaTone(m)]
        return (
          <div key={m.label} className="flex flex-col gap-2.5 border-b border-border py-4 last:border-b-0">
            <div className="flex items-baseline justify-between gap-2">
              {/* No (i) beside the title: the name itself opens its definition. */}
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold text-foreground">
                  <GlossaryTerm term={m.term} quiet>{m.label}</GlossaryTerm>
                </span>
                <span className="text-[11px] text-muted-foreground" data-testid="dynamics-better">
                  {d.better[BETTER[m.term]]}
                </span>
              </span>
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {m.display}
                <span className="text-xs font-normal text-muted-foreground"> {m.unit}</span>
              </span>
            </div>
            {m.band ? (
              <RangeTrack label={m.label} value={m.value} band={m.band} decimals={m.decimals} note={sentence} noteInk={ink} />
            ) : (
              sentence && <p className="text-xs" style={{ color: ink }} data-testid="dynamics-delta">{sentence}</p>
            )}
          </div>
        )
      })}
    </section>
  )
}
