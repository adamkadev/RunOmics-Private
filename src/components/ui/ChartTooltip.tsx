import type { ReactNode } from 'react'
import { tooltipSurfaceClass } from '@/components/ui/Card'

export function TooltipCard({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div className={tooltipSurfaceClass}>
      {label != null && label !== '' && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      )}
      {children}
    </div>
  )
}
