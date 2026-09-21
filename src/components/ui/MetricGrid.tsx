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
              // 22px, not 28: measured against an 82px cell at 390px, `1:11:23`
              // needs 91px at 28 and 71 at 22. The review argued for 28 on the
              // arithmetic of `55:01`, which was formatDurationShort's h:mm -
              // and that formatter is gone, so the strip renders h:mm:ss now.
              // truncate so a 10-hour ultra clips instead of spilling.
              'truncate text-title2 font-bold leading-none tracking-tight',
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
