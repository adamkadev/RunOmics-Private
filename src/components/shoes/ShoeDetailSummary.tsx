import { Footprints, ListChecks, History, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ShoeDetail } from '@/application/usecases/GetShoeDetail'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { cardClass } from '@/components/ui/Card'
import { formatDateWithYear } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface StatCell {
  Icon: LucideIcon
  color: string
  borderTop: string
  value: ReactNode
  label: string
}

export function ShoeDetailSummary({ shoe }: { shoe: ShoeDetail }) {
  const s = t.shoes.detail.stats

  const cells: StatCell[] = [
    {
      Icon: Footprints,
      color: 'text-emerald-500 dark:text-emerald-400',
      borderTop: 'border-t-emerald-400 dark:border-t-emerald-500',
      value: <><AnimatedValue value={shoe.totalKm} decimals={1} /> {t.units.km}</>,
      label: s.distance,
    },
    {
      Icon: ListChecks,
      color: 'text-blue-500 dark:text-blue-400',
      borderTop: 'border-t-blue-400 dark:border-t-blue-500',
      value: <AnimatedValue value={shoe.sessionCount} />,
      label: s.activities,
    },
    {
      Icon: History,
      color: 'text-orange-500 dark:text-orange-400',
      borderTop: 'border-t-orange-400 dark:border-t-orange-500',
      value: shoe.firstUsedDate ? formatDateWithYear(shoe.firstUsedDate) : t.shoes.neverUsed,
      label: s.firstUsed,
    },
  ]

  return (
    <div className={cn(cardClass({ overflow: true, padding: 'none' }), 'grid grid-cols-3 gap-px bg-border')}>
      {cells.map(({ Icon, color, borderTop, value, label }) => (
        <div
          key={label}
          className={cn('flex flex-col items-center gap-0.5 border-t-2 bg-card px-3 py-3.5 text-center', borderTop)}
        >
          <Icon size={14} className={color} />
          <div className="whitespace-nowrap text-sm font-bold leading-tight text-foreground">{value}</div>
          <div className="text-[10px] leading-tight text-muted-foreground">{label}</div>
        </div>
      ))}
    </div>
  )
}
