import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
import { round } from '@/lib/math'
import { t } from '@/i18n'
import { cardClass } from '../ui/Card'

export function ShoesSummary({ shoes }: { shoes: ShoeStats[] }) {
  const s = t.shoes.summary

  const totalKm = round(shoes.reduce((sum, shoe) => sum + shoe.totalKm, 0), 1)
  const activePairs = shoes.filter((shoe) => !shoe.retired).length
  const totalSessions = shoes.reduce(
    (sum, shoe) => sum + shoe.sessionCount,
    0,
  )

  const metrics: Metric[] = [
    {
      value: <AnimatedValue value={totalKm} decimals={1} />,
      unit: t.units.km,
      label: s.totalDistance,
    },
    {
      value: <AnimatedValue value={activePairs} />,
      label: s.activePairs,
    },
    {
      value: <AnimatedValue value={totalSessions} />,
      label: s.sessions,
    },
  ]

  return (
    <div className={cardClass({ overflow: true, padding: 'none' })}> 
      <MetricGrid metrics={metrics} className="grid-cols-3" />
    </div>
  )
}