import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type LegendSwatch = 'square' | 'dot' | 'diamond' | 'line' | 'dash' | 'ring' | 'dashRing' | 'dashCircle' | 'tint' | 'outline'

export function LegendItem({ swatch, color, children, size = 8 }: { swatch: LegendSwatch; color: string; children: ReactNode; size?: number }) {
  const style: CSSProperties =
    swatch === 'line'
      ? { width: 14, height: 2, background: color }
      : swatch === 'dash'
        ? { width: 14, borderTop: `2px dashed ${color}` }
        : swatch === 'ring'
          ? { width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${color}` }
          : swatch === 'dashRing'
            ? { width: size, height: size, borderRadius: 2, border: `1px dashed ${color}` }
            : swatch === 'dashCircle'
              ? { width: 9, height: 9, borderRadius: '50%', border: `1.5px dashed ${color}` }
            : swatch === 'diamond'
              ? { width: 7, height: 7, margin: 1, transform: 'rotate(45deg)', background: color }
            : swatch === 'tint'
              ? { width: 8, height: 8, borderRadius: 2, border: `1px solid ${color}`, background: `color-mix(in srgb, ${color} 14%, transparent)` }
              : swatch === 'outline'
                ? { width: 8, height: 8, borderRadius: 2, border: `1.5px solid ${color}` }
                : { width: size, height: size, borderRadius: swatch === 'dot' ? '50%' : 2, background: color }
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
