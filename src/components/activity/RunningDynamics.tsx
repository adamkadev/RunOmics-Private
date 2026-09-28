import type { ActivityDetailView } from './activityViews'
import type { BaselineRange, DynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { cardClass } from '@/components/ui/Card'
import { GlossaryTerm } from '@/components/ui/GlossaryTerm'
import { RangeBar } from '@/components/ui/RangeBar'
import { formatDelta } from '@/lib/formatters'
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

/**
 * The run on its 8-week range (H17, M10, v4.17): the ends are the lowest and
 * highest of those weeks (stretched to take this run), the shaded band the
 * middle half of them - the baseline - and the marker this run. The range
 * and what the run says against the baseline go under it.
 */
function RangeTrack({ label, value, band, decimals, note }: { label: string; value: number; band: BaselineRange; decimals: number; note: string | null }) {
  const lo = Math.min(band.min, value)
  const hi = Math.max(band.max, value)
  const at = (v: number) => (hi > lo ? (v - lo) / (hi - lo) : 0.5)

  return (
    <div data-testid="range-track">
      <RangeBar
        label={`${label}: ${value.toFixed(decimals)}, ${lo.toFixed(decimals)}–${hi.toFixed(decimals)}`}
        band={[at(band.low), at(band.high)]}
        bandTone="baseline"
        marker={at(value)}
        caption={
          <div className="flex justify-between gap-3 tabular-nums">
            <span>{lo.toFixed(decimals)}</span>
            {note && <span className="text-center text-[var(--text-2)]">{note}</span>}
            <span>{hi.toFixed(decimals)}</span>
          </div>
        }
      />
    </div>
  )
}

/**
 * "−0.04 m vs baseline": a delta against the baseline's median, with its
 * unit, in text-2 - a note, never a status colour (H17).
 */
export function deltaSentence(m: Pick<Metric, 'value' | 'band' | 'decimals' | 'deltaUnit'>): string | null {
  const d = t.activity.dynamics
  if (!m.band) return null
  const delta = Number((m.value - m.band.median).toFixed(m.decimals))
  return delta === 0 ? d.level : `${formatDelta(delta)} ${m.deltaUnit} ${d.vsBaselineShort}`
}

export function RunningDynamics({ activity: a, baseline }: Props) {
  const d = t.activity.dynamics
  const metrics: Metric[] = []

  if (a.strideLengthM != null) {
    metrics.push({
      label: d.strideLength,
      term: 'strideLength',
      value: a.strideLengthM,
      display: a.strideLengthM.toFixed(2),
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
      display: a.groundContactMs.toFixed(0),
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
      display: a.verticalOscillationMm.toFixed(1),
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
      display: a.verticalRatioPct.toFixed(1),
      unit: t.units.percent,
      deltaUnit: d.ratioUnit,
      decimals: 1,
      band: baseline?.verticalRatioPct ?? null,
    })
  }

  if (!metrics.length) return null

  return (
    <section className={cardClass({ padding: 'none', className: 'px-5 py-1.5' })} data-testid="running-dynamics">
      {metrics.map((m) => {
        const sentence = deltaSentence(m)
        return (
          <div key={m.label} className="flex flex-col gap-2.5 border-b border-border py-4 last:border-b-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                <GlossaryTerm term={m.term}>{m.label}</GlossaryTerm>
              </span>
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {m.display}
                <span className="text-xs font-normal text-muted-foreground"> {m.unit}</span>
              </span>
            </div>
            {m.band ? (
              <RangeTrack label={m.label} value={m.value} band={m.band} decimals={m.decimals} note={sentence} />
            ) : (
              sentence && <p className="text-xs text-[var(--text-2)]">{sentence}</p>
            )}
          </div>
        )
      })}
      {baseline && <p className="py-3 text-xs text-muted-foreground">{d.baselineNote(baseline.weeks)}</p>}
    </section>
  )
}
