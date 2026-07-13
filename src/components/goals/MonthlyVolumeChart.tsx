import type { MonthGoal } from '@/application/usecases/GetGoalsData'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { monthLabel } from '@/lib/formatters'
import { t } from '@/i18n'

function barHeightPercent(mg: MonthGoal): number {
  const pct = mg.targetKm > 0 ? Math.min((mg.actualKm / mg.targetKm) * 100, 100) : 0
  return Math.max(pct, 6)
}

export function MonthlyVolumeChart({ monthlyGoals }: { monthlyGoals: MonthGoal[] }) {
  const elapsedMonths = monthlyGoals.filter((mg) => mg.status !== 'pending')
  if (elapsedMonths.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {t.goals.monthlyVolume}
      </h2>
      <GlassSurface variant="card" className="flex h-24 items-end gap-2 rounded-card-sm p-4">
        {elapsedMonths.map((mg) => (
          <div
            key={mg.month}
            className="w-3 rounded-sm transition-all"
            title={`${monthLabel(mg.month)}: ${mg.actualKm} / ${mg.targetKm} km`}
            style={{
              height: `${barHeightPercent(mg)}%`,
              background: mg.status === 'behind' ? 'var(--color-missed)' : 'var(--accent)',
            }}
          />
        ))}
      </GlassSurface>
    </section>
  )
}
