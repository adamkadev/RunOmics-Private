import { cn } from '@/lib/utils'

interface CardOptions {
  padding?: 'none' | 'sm' | 'base' | 'lg'
  clickable?: boolean
  dashed?: boolean
  overflow?: boolean
  className?: string
}

export function cardClass({
  padding = 'base',
  clickable,
  dashed,
  overflow,
  className,
}: CardOptions = {}): string {
  return cn(
    // Never glass, never blurred: cards are the content layer.
    // content-card is the hook globals.css gives the light Aura's 88 % white.
    'content-card rounded-[24px] bg-card shadow-[var(--card-edge)]',
    padding === 'sm'   && 'p-3',
    padding === 'base' && 'p-4',
    padding === 'lg'   && 'p-5',
    overflow  && 'overflow-hidden',
    clickable && 'cursor-pointer transition-transform duration-100 ease-out active:scale-[0.98]',
    dashed    && 'border border-dashed border-border',
    className
  )
}

/** With the card's 16 pt padding the tile grid takes `-mx-1 -mb-1`, so the corners are concentric (24 - 12). */
export const insetTileClass = 'inset-tile rounded-[12px] px-3 py-2.5'

export const tileLabelClass = 'text-[11px] font-semibold uppercase leading-[13px] tracking-[0.06em] text-muted-foreground'

export const tooltipSurfaceClass = 'rounded-lg border border-border bg-[var(--popover)] px-2.5 py-2 text-xs shadow-[var(--shadow-raised)]'
