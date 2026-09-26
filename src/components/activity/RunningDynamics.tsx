import type { ActivityDetailView } from './activityViews'
import type { BaselineRange, DynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { GlossaryTerm } from '@/components/ui/GlossaryTerm'
import { formatDelta } from '@/lib/formatters'
import { cn } from '@/lib/utils'
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
 * The run on its 8-week range (H17, M10): the ends are the lowest and highest
 * of those weeks (stretched to take this run), the grey tick is the baseline,
 * the bright tick this run.
 */
function RangeTrack({ value, band, decimals }: { value: number; band: BaselineRange; decimals: number }) {
  const lo = Math.min(band.min, value)
  const hi = Math.max(band.max, value)
  const at = (v: number) => (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50)

  return (
    <div className="mt-2.5 flex items-center gap-3 text-footnote tabular-nums text-muted-foreground">
      <span className="shrink-0">{lo.toFixed(decimals)}</span>
      <div className="relative h-1.5 flex-1 rounded-full bg-[var(--track)]" data-testid="range-track">
        <span
          aria-hidden="true"
          data-testid="baseline-tick"
          className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-muted-foreground"
          style={{ left: `${at(band.median)}%` }}
        />
        <span
          aria-hidden="true"
          data-testid="value-tick"
          className="absolute -top-1.5 h-4.5 w-1 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: `${at(value)}%` }}
        />
      </div>
      <span className="shrink-0">{hi.toFixed(decimals)}</span>
    </div>
  )
}

/**
 * "−0.04 m vs baseline", in grey: a delta against the baseline tick, with its
 * unit. Orange is a zone colour, not "worse" (H17).
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
    <GlassSurface variant="card" className="rounded-[22px] px-4.5 py-1" data-testid="running-dynamics">
      {metrics.map((m, i) => {
        const sentence = deltaSentence(m)
        return (
          <div key={m.label} className={cn('py-3.5', i > 0 && 'border-t border-border')}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-subhead text-foreground">
                <GlossaryTerm term={m.term}>{m.label}</GlossaryTerm>
              </span>
              <span className="font-display text-title3 font-bold tabular-nums text-foreground">
                {m.display}
                <span className="text-footnote font-medium text-muted-foreground"> {m.unit}</span>
              </span>
            </div>
            {m.band && <RangeTrack value={m.value} band={m.band} decimals={m.decimals} />}
            {sentence && <p className="mt-2 text-footnote tabular-nums text-muted-foreground">{sentence}</p>}
          </div>
        )
      })}
    </GlassSurface>
  )
}
