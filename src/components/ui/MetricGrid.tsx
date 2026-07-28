import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export interface Metric {
  value: ReactNode
  unit?: string
  label: string
  /** Render the value in the accent color (e.g. a form/status highlight). */
  accent?: boolean
  /** Override the value's color entirely (e.g. a multi-tone semantic like RPE). */
  valueClassName?: string
}

/**
 * Clean grid of numeric metrics: bold value + muted unit + muted label.
 * No colored borders or per-cell icons - the data carries the weight, a
 * single accent only where a value is genuinely a highlight.
 */
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
              'text-lg font-extrabold leading-none tracking-tight',
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
