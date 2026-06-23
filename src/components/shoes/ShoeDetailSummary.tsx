import type { ShoeDetail } from '@/application/usecases/GetShoeDetail'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
import { formatDateWithYear } from '@/lib/formatters'
import { t } from '@/i18n'

export function ShoeDetailSummary({ shoe }: { shoe: ShoeDetail }) {
  const s = t.shoes.detail.stats

  const metrics: Metric[] = [
    {
      value: <AnimatedValue value={shoe.totalKm} decimals={1} />,
      unit: t.units.km,
      label: s.distance,
    },
    {
      value: <AnimatedValue value={shoe.sessionCount} />,
      label: s.activities,
    },
    {
      value: shoe.firstUsedDate ? formatDateWithYear(shoe.firstUsedDate) : t.shoes.neverUsed,
      label: s.firstUsed,
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-px bg-border">
      <div className="col-span-3 bg-card p-4">
        <MetricGrid metrics={metrics} className="grid-cols-3 px-4 py-4" />
      </div>
    </div>
  )
}