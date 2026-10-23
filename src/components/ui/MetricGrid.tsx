import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { Stat } from './Stat'

export interface Metric {
  value: ReactNode
  unit?: string
  label: string
  accent?: boolean
  valueClassName?: string
}

export function MetricGrid({
  metrics,
  className,
}: {
  metrics: Metric[]
  className?: string
}) {
  return (
    <div className={cn('grid gap-4', className)}>
      {metrics.map(({ value, unit, label, accent, valueClassName }) => (
        <Stat
          key={label}
          label={label}
          value={<span className={valueClassName ?? (accent ? 'text-accent-text' : undefined)}>{value}</span>}
          unit={unit}
        />
      ))}
    </div>
  )
}
