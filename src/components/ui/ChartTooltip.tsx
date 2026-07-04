import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { tooltipSurfaceClass } from '@/components/ui/Card'

/** Shared card shell for Recharts tooltips: bordered surface + optional muted label. */
export function TooltipCard({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div className={cn(tooltipSurfaceClass, 'dark:bg-muted')}>
      {label != null && label !== '' && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      )}
      {children}
    </div>
  )
}

/** One series line in a multi-series tooltip: colored dot · name · value. */
export function TooltipRow({
  color,
  name,
  value,
}: {
  color?: string
  name: string
  value: ReactNode
}) {
  return (
    <p className="flex items-center gap-1.5 text-xs">
      {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      <span className="text-muted-foreground">{name}:</span>
      <span className="font-semibold text-foreground">{value}</span>
    </p>
  )
}

interface RechartsTooltipPayloadEntry {
  dataKey: string
  value: number
}

/**
 * Recharts tooltip content for a chart with a single plotted series (e.g. the
 * activity detail's HR/pace/cadence/elevation charts). Looks up `dataKey` in
 * the payload so it renders nothing while the area is dimmed/absent (e.g.
 * HR zone filtering).
 */
export function SingleSeriesTooltip({
  active,
  payload,
  label,
  dataKey,
  color,
  name,
  formatValue,
}: {
  active?: boolean
  payload?: RechartsTooltipPayloadEntry[]
  label?: number
  dataKey: string
  color: string
  name: string
  formatValue: (value: number) => string
}) {
  const value = payload?.find((p) => p.dataKey === dataKey)?.value
  if (!active || value == null || label == null) return null
  return (
    <TooltipCard label={`${label.toFixed(1)} km`}>
      <TooltipRow color={color} name={name} value={formatValue(value)} />
    </TooltipCard>
  )
}
