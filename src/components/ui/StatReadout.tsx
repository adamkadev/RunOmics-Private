import type { ReactNode } from 'react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'

export interface StatReadoutItem {
  key: string
  label: string
  /** Drawn as a swatch beside the label, never the only key to the value. */
  color: string
  value: string | null
  unit: string
}

const COLUMNS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }

export function StatReadout({ heading, items, className }: { heading: ReactNode; items: StatReadoutItem[]; className?: string }) {
  return (
    <GlassSurface variant="card" className={cn('rounded-2xl px-3.5 py-2.5', className)} aria-live="polite">
      <div className="text-xs text-muted-foreground">{heading}</div>
      <div className={cn('mt-2 grid gap-2', COLUMNS[Math.min(4, Math.max(1, items.length))])}>
        {items.map((item) => (
          <div key={item.key} className="min-w-0">
            <div className="flex items-center gap-1.25 text-caption text-subtle">
              <span aria-hidden="true" className="block h-0.75 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="truncate">{item.label}</span>
            </div>
            <div className="text-body font-bold tabular-nums text-foreground">
              {item.value ?? '—'}
              <span className="text-caption font-normal text-muted-foreground"> {item.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </GlassSurface>
  )
}
