import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { tooltipSurfaceClass } from '@/components/ui/Card'

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
