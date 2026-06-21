import { Footprints, Heart, Activity, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ShoeStats } from '@/application/usecases/GetShoeStats'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { cardClass } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { round } from '@/lib/math'
import { t } from '@/i18n'

interface StatCell {
  Icon: LucideIcon
  color: string
  borderTop: string
  value: ReactNode
  label: string
}

export function ShoesSummary({ shoes }: { shoes: ShoeStats[] }) {
  const s = t.shoes.summary

  const totalKm = round(shoes.reduce((sum, shoe) => sum + shoe.totalKm, 0), 1)
  const activePairs = shoes.filter((shoe) => !shoe.retired).length
  const totalSessions = shoes.reduce((sum, shoe) => sum + shoe.sessionCount, 0)

  const cells: StatCell[] = [
    {
      Icon: Footprints,
      color: 'text-emerald-500 dark:text-emerald-400',
      borderTop: 'border-t-emerald-400 dark:border-t-emerald-500',
      value: <><AnimatedValue value={totalKm} decimals={1} /> {t.units.km}</>,
      label: s.totalDistance,
    },
    {
      Icon: Activity,
      color: 'text-blue-500 dark:text-blue-400',
      borderTop: 'border-t-blue-400 dark:border-t-blue-500',
      value: <AnimatedValue value={activePairs} />,
      label: s.activePairs,
    },
    {
      Icon: Heart,
      color: 'text-violet-500 dark:text-violet-400',
      borderTop: 'border-t-violet-400 dark:border-t-violet-500',
      value: <AnimatedValue value={totalSessions} />,
      label: s.sessions,
    },
  ]

  return (
    <div className={cn(cardClass({ overflow: true, padding: 'none' }), 'grid grid-cols-3 gap-px bg-border')}>
      {cells.map(({ Icon, color, borderTop, value, label }) => (
        <div
          key={label}
          className={cn('flex flex-col items-center gap-0.5 border-t-2 bg-card px-2 py-2 text-center sm:px-3 sm:py-3.5', borderTop)}
        >
          <Icon className={cn('size-3 sm:size-3.5', color)} />
          <div className="whitespace-nowrap text-xs font-bold leading-tight text-foreground sm:text-sm">{value}</div>
          <div className="text-[9px] leading-tight text-muted-foreground sm:text-[10px]">{label}</div>
        </div>
      ))}
    </div>
  )
}
