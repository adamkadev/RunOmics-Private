import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

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
    <div className={cn('grid gap-y-4 gap-x-2', className)}>
      {metrics.map(({ value, unit, label, accent, valueClassName }) => (
        <div key={label} className="min-w-0">
          <div
            className={cn(
              'text-title1 font-bold leading-none tracking-tight',
              valueClassName ?? (accent ? 'text-accent-text' : 'text-foreground')
            )}
          >
            {value}
            {unit && <span className="ml-0.5 text-caption font-semibold text-muted-foreground">{unit}</span>}
          </div>
          <div className="mt-1 text-caption leading-tight text-muted-foreground">{label}</div>
        </div>
      ))}
    </div>
  )
}
