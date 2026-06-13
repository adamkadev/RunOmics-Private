import type { Activity } from '@/domain/activity/types'

interface Metric {
  label: string
  value: string
  unit: string
}

export function RunningDynamics({ activity: a }: { activity: Activity }) {
  const metrics: Metric[] = []

  if (a.cadenceSpm != null) {
    metrics.push({ label: 'Cadence', value: a.cadenceSpm.toFixed(0), unit: 'spm' })
  }
  if (a.strideLengthM != null) {
    metrics.push({ label: 'Stride Length', value: a.strideLengthM.toFixed(2), unit: 'm' })
  }
  if (a.groundContactMs != null) {
    metrics.push({ label: 'Ground Contact', value: a.groundContactMs.toFixed(0), unit: 'ms' })
  }
  if (a.verticalOscillationMm != null) {
    metrics.push({ label: 'Vert. Oscillation', value: a.verticalOscillationMm.toFixed(1), unit: 'mm' })
  }
  if (a.verticalRatioPct != null) {
    metrics.push({ label: 'Vert. Ratio', value: a.verticalRatioPct.toFixed(1), unit: '%' })
  }

  if (!metrics.length) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground/80">
        Running Dynamics
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-sm font-semibold text-foreground">
              {m.value} <span className="text-xs font-normal text-gray-400">{m.unit}</span>
            </p>
            <p className="text-xs text-subtle">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
