import type { Activity } from '@/domain/activity/types'
import type { DynamicsBaseline } from '@/application/usecases/GetDynamicsBaseline'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { formatDelta } from '@/lib/formatters'
import { t } from '@/i18n'

interface Metric {
  label: string
  value: string
  unit: string
  delta: number | null
}

interface Props {
  activity: Activity
  baseline: DynamicsBaseline | null
}

export function RunningDynamics({ activity: a, baseline }: Props) {
  const metrics: Metric[] = []
  const d = t.activity.dynamics

  const delta = (value: number, median: number | null | undefined, decimals: number) =>
    typeof median === 'number' ? Number((value - median).toFixed(decimals)) : null

  if (a.strideLengthM != null) {
    metrics.push({
      label: d.strideLength,
      value: a.strideLengthM.toFixed(2),
      unit: t.units.m,
      delta: delta(a.strideLengthM, baseline?.strideLengthM, 2),
    })
  }
  if (a.groundContactMs != null) {
    metrics.push({
      label: d.groundContact,
      value: a.groundContactMs.toFixed(0),
      unit: t.units.ms,
      delta: delta(a.groundContactMs, baseline?.groundContactMs, 0),
    })
  }
  if (a.verticalOscillationMm != null) {
    metrics.push({
      label: d.vertOscillation,
      value: a.verticalOscillationMm.toFixed(1),
      unit: t.units.mm,
      delta: delta(a.verticalOscillationMm, baseline?.verticalOscillationMm, 1),
    })
  }
  if (a.verticalRatioPct != null) {
    metrics.push({
      label: d.vertRatio,
      value: a.verticalRatioPct.toFixed(1),
      unit: t.units.percent,
      delta: delta(a.verticalRatioPct, baseline?.verticalRatioPct, 1),
    })
  }

  if (!metrics.length) return null

  return (
    <GlassSurface variant="card" className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        {t.activity.dynamics.title}
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-sm font-semibold text-foreground">
              {m.value} <span className="text-xs font-normal text-subtle">{m.unit}</span>
            </p>
            <p className="text-xs text-subtle">{m.label}</p>
            {baseline && m.delta !== null && (
              <p className="mt-0.5 text-micro tabular-nums text-subtle-2">
                {m.delta === 0
                  ? d.atBaseline(baseline.weeks)
                  : d.vsBaseline(formatDelta(m.delta), baseline.weeks)}
              </p>
            )}
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}
