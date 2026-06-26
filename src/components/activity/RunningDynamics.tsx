import type { Activity } from '@/domain/activity/types'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

interface Metric {
  label: string
  value: string
  unit: string
}

export function RunningDynamics({ activity: a }: { activity: Activity }) {
  const metrics: Metric[] = []
  const d = t.activity.dynamics

  if (a.strideLengthM != null) {
    metrics.push({ label: d.strideLength, value: a.strideLengthM.toFixed(2), unit: t.units.m })
  }
  if (a.groundContactMs != null) {
    metrics.push({ label: d.groundContact, value: a.groundContactMs.toFixed(0), unit: t.units.ms })
  }
  if (a.verticalOscillationMm != null) {
    metrics.push({ label: d.vertOscillation, value: a.verticalOscillationMm.toFixed(1), unit: t.units.mm })
  }
  if (a.verticalRatioPct != null) {
    metrics.push({ label: d.vertRatio, value: a.verticalRatioPct.toFixed(1), unit: t.units.percent })
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
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}
