import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type LegendSwatch = 'square' | 'dot' | 'diamond' | 'line' | 'dash' | 'ring' | 'dashRing' | 'dashCircle' | 'tint' | 'outline'

/**
 * A legend entry (v4.17): an 8 px swatch - a square for bars, a circle for
 * points, a 14 px line for series; a ring for an outline-only mark such as
 * a race; a tinted square for a soft fill (a missed day) and an outlined one
 * for an outline (today); a diamond and a dashed circle for marks drawn in
 * those shapes (v4.17.2) - then a 12 px muted label.
 */
export function LegendItem({ swatch, color, children }: { swatch: LegendSwatch; color: string; children: ReactNode }) {
  const style: CSSProperties =
    swatch === 'line'
      ? { width: 14, height: 2, background: color }
      : swatch === 'dash'
        ? { width: 14, borderTop: `2px dashed ${color}` }
        : swatch === 'ring'
          ? { width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${color}` }
          : swatch === 'dashRing'
            ? { width: 8, height: 8, borderRadius: 2, border: `1.5px dashed ${color}` }
            : swatch === 'dashCircle'
              ? { width: 9, height: 9, borderRadius: '50%', border: `1.5px dashed ${color}` }
            : swatch === 'diamond'
              ? { width: 7, height: 7, margin: 1, transform: 'rotate(45deg)', background: color }
            : swatch === 'tint'
              ? { width: 8, height: 8, borderRadius: 2, border: `1px solid ${color}`, background: `color-mix(in srgb, ${color} 14%, transparent)` }
              : swatch === 'outline'
                ? { width: 8, height: 8, borderRadius: 2, border: `1.5px solid ${color}` }
                : { width: 8, height: 8, borderRadius: swatch === 'dot' ? '50%' : 2, background: color }
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="box-border shrink-0" style={style} />
      {children}
    </span>
  )
}

export function Legend({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground', className)}>{children}</div>
}
