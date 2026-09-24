import type { ActivityDetailView } from './activityViews'
import type { BaselineRange, DynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartCardHead } from '@/components/ui/ChartCard'
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
  decimals: number
  band: BaselineRange | null
  /** The direction that reads as better form, so the verdict can be coloured. */
  lowerIsBetter: boolean
  verdict: { up: string; down: string }
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
    <div className="mt-1 flex items-center gap-2">
      <span className="w-10 shrink-0 text-right text-micro tabular-nums text-subtle-2">{band.min}</span>
      <div className="relative h-1 flex-1 rounded-full bg-foreground/[0.08]">
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/70"
          style={{ left: `${clamped}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-micro tabular-nums text-subtle-2">{band.max}</span>
    </div>
  )
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
      decimals: 2,
      band: baseline?.strideLengthM ?? null,
      lowerIsBetter: false,
      verdict: { up: d.verdict.longer, down: d.verdict.shorter },
    })
  }
  if (a.groundContactMs != null) {
    metrics.push({
      label: d.groundContact,
      value: a.groundContactMs,
      display: a.groundContactMs.toFixed(0),
      unit: t.units.ms,
      decimals: 0,
      band: baseline?.groundContactMs ?? null,
      lowerIsBetter: true,
      verdict: { up: d.verdict.slower, down: d.verdict.quicker },
    })
  }
  if (a.verticalOscillationMm != null) {
    metrics.push({
      label: d.vertOscillation,
      value: a.verticalOscillationMm,
      display: a.verticalOscillationMm.toFixed(1),
      unit: t.units.mm,
      decimals: 1,
      band: baseline?.verticalOscillationMm ?? null,
      lowerIsBetter: true,
      verdict: { up: d.verdict.bouncier, down: d.verdict.tighter },
    })
  }
  if (a.verticalRatioPct != null) {
    metrics.push({
      label: d.vertRatio,
      value: a.verticalRatioPct,
      display: a.verticalRatioPct.toFixed(1),
      unit: t.units.percent,
      decimals: 1,
      band: baseline?.verticalRatioPct ?? null,
      lowerIsBetter: true,
      verdict: { up: d.verdict.costlier, down: d.verdict.flatter },
    })
  }

  if (!metrics.length) return null

  return (
    <>
      <GlassSurface variant="card" className="p-5">
        <ChartCardHead
          title={d.title}
          controls={baseline ? <span className="text-caption text-subtle">{d.band(baseline.weeks)}</span> : undefined}
        />
        <div className="space-y-3.5">
          {metrics.map((m) => {
            const delta =
              m.band !== null ? Number((m.value - m.band.median).toFixed(m.decimals)) : null
            const improved = delta === null || delta === 0 ? null : delta < 0 === m.lowerIsBetter
            const status = improved === null ? null : improved ? STATUS.success : STATUS.warning
            const verdictWord =
              delta === null ? null : delta === 0 ? d.verdict.level : delta > 0 ? m.verdict.up : m.verdict.down

            return (
              <div key={m.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-subtle">{m.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {m.display} <span className="text-xs font-normal text-subtle">{m.unit}</span>
                    </span>
                    {verdictWord && (
                      <span
                        className={cn(
                          'text-micro font-semibold tabular-nums',
                          delta === 0 ? 'text-subtle-2' : status?.text,
                        )}
                      >
                        {delta === 0 ? `±0` : formatDelta(delta!)}{' '}
                        <span className="uppercase tracking-[0.08em]">{verdictWord}</span>
                      </span>
                    )}
                  </span>
                </div>
                {m.band && <BandBar value={m.value} band={m.band} />}
              </div>
            )
          })}
        </div>
      </GlassSurface>

      <FormThroughRun cadenceSamples={a.cadenceSamples} distanceKm={a.distanceKm} />
    </>
  )
}
