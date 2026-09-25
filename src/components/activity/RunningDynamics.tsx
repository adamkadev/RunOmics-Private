import type { ActivityDetailView } from './activityViews'
import type { BaselineRange, DynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { STATUS } from '@/lib/statusColors'
import { formatDelta } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { FormThroughRun } from './FormThroughRun'

interface Metric {
  label: string
  value: number
  display: string
  unit: string
  /** The unit a delta is written in: "pt" for a ratio's percentage points. */
  deltaUnit: string
  decimals: number
  band: BaselineRange | null
  /** The direction that reads as better form, so the delta can be coloured. */
  lowerIsBetter: boolean
  phrase: { up: string; down: string }
}

interface Props {
  activity: ActivityDetailView
  baseline: DynamicsBaseline | null
}

function BandBar({ value, band }: { value: number; band: BaselineRange }) {
  const span = band.max - band.min
  const position = span > 0 ? ((value - band.min) / span) * 100 : 50
  const clamped = Math.min(100, Math.max(0, position))

  return (
    <div className="mt-2 flex items-center gap-2 text-caption tabular-nums text-subtle">
      <span className="w-8 shrink-0">{band.min}</span>
      <div className="relative h-1.5 flex-1 rounded-full bg-foreground/[0.08]">
        <span
          aria-hidden="true"
          className="absolute -top-1 h-3.5 w-0.75 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: `${clamped}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right">{band.max}</span>
    </div>
  )
}

/**
 * "+0.06 m longer than baseline", "+0.5 pt less economical · your 8-week
 * high": each delta is a sentence with its unit, against the named baseline,
 * coloured by whether it is better or worse for that metric. It used to read
 * "+10 SLOWER", all caps, with no reference, and a marker at the track's edge
 * looked like a clipped bar.
 */
export function deltaSentence(m: Pick<Metric, 'value' | 'band' | 'decimals' | 'deltaUnit' | 'phrase'>, weeks: number): string | null {
  const d = t.activity.dynamics
  if (!m.band) return null
  const delta = Number((m.value - m.band.median).toFixed(m.decimals))
  const main = delta === 0 ? d.deltas.level : `${formatDelta(delta)} ${m.deltaUnit} ${delta > 0 ? m.phrase.up : m.phrase.down}`
  const edge = m.value >= m.band.max ? d.atHigh(weeks) : m.value <= m.band.min ? d.atLow(weeks) : null
  return edge ? `${main} · ${edge}` : main
}

export function RunningDynamics({ activity: a, baseline }: Props) {
  const d = t.activity.dynamics
  const metrics: Metric[] = []

  if (a.strideLengthM != null) {
    metrics.push({
      label: d.strideLength,
      value: a.strideLengthM,
      display: a.strideLengthM.toFixed(2),
      unit: t.units.m,
      deltaUnit: t.units.m,
      decimals: 2,
      band: baseline?.strideLengthM ?? null,
      lowerIsBetter: false,
      phrase: d.deltas.strideLength,
    })
  }
  if (a.groundContactMs != null) {
    metrics.push({
      label: d.groundContact,
      value: a.groundContactMs,
      display: a.groundContactMs.toFixed(0),
      unit: t.units.ms,
      deltaUnit: t.units.ms,
      decimals: 0,
      band: baseline?.groundContactMs ?? null,
      lowerIsBetter: true,
      phrase: d.deltas.groundContact,
    })
  }
  if (a.verticalOscillationMm != null) {
    metrics.push({
      label: d.vertOscillation,
      value: a.verticalOscillationMm,
      display: a.verticalOscillationMm.toFixed(1),
      unit: t.units.mm,
      deltaUnit: t.units.mm,
      decimals: 1,
      band: baseline?.verticalOscillationMm ?? null,
      lowerIsBetter: true,
      phrase: d.deltas.verticalOscillation,
    })
  }
  if (a.verticalRatioPct != null) {
    metrics.push({
      label: d.vertRatio,
      value: a.verticalRatioPct,
      display: a.verticalRatioPct.toFixed(1),
      unit: t.units.percent,
      deltaUnit: d.ratioUnit,
      decimals: 1,
      band: baseline?.verticalRatioPct ?? null,
      lowerIsBetter: true,
      phrase: d.deltas.verticalRatio,
    })
  }

  if (!metrics.length) return null
  const weeks = baseline?.weeks ?? 0

  return (
    <>
      <GlassSurface variant="card" className="rounded-card-sm px-4 pb-2.5 pt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-subhead font-semibold text-foreground">{d.title}</h3>
          {baseline && <span className="text-xs text-muted-foreground">{d.vsBaseline(weeks)}</span>}
        </div>
        <div>
          {metrics.map((m) => {
            const delta = m.band !== null ? Number((m.value - m.band.median).toFixed(m.decimals)) : null
            const improved = delta === null || delta === 0 ? null : delta < 0 === m.lowerIsBetter
            const sentence = deltaSentence(m, weeks)

            return (
              <div key={m.label} className="border-b border-border py-2.75">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{m.label}</span>
                  <span className="text-lg font-bold tabular-nums text-foreground">
                    {m.display}
                    <span className="text-xs font-medium text-muted-foreground"> {m.unit}</span>
                  </span>
                </div>
                {m.band && <BandBar value={m.value} band={m.band} />}
                {sentence && (
                  <p
                    className={cn(
                      'mt-1.5 text-xs font-semibold',
                      improved === null ? 'text-muted-foreground' : improved ? STATUS.success.text : STATUS.warning.text,
                    )}
                  >
                    {sentence}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </GlassSurface>

      <FormThroughRun cadenceSamples={a.cadenceSamples} distanceKm={a.distanceKm} />
    </>
  )
}
