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
    // Liquid Glass v3 (G8): radius 24, no line - the surface and a hairline
    // shadow (--card-edge) - and 16 pt padding. Cards are the content layer:
    // never glass, never blurred (D1).
    // content-card: the hook the light Aura's 88 % white takes (globals.css).
    'content-card rounded-[24px] bg-card shadow-[var(--card-edge)]',
    padding === 'sm'   && 'p-3',
    padding === 'base' && 'p-4',
    padding === 'lg'   && 'p-5',
    overflow  && 'overflow-hidden',
    // Content press: a card that is a target settles under the finger.
    clickable && 'cursor-pointer transition-transform duration-100 ease-out active:scale-[0.98]',
    dashed    && 'border border-dashed border-border',
    className
  )
}

/**
 * A tile inset in a card (G8): radius 12, the page ground (a faint fill on
 * the light Aura's cards), 12 pt from the card's edge - so with the
 * card's 16 pt padding the tile grid takes `-mx-1 -mb-1`, and the two corners
 * are concentric (24 - 12).
 */
export const insetTileClass = 'inset-tile rounded-[12px] px-3 py-2.5'

/** An inset tile's caps label: 11/13, 600, +0.06em. */
export const tileLabelClass = 'text-[11px] font-semibold uppercase leading-[13px] tracking-[0.06em] text-muted-foreground'

export const tooltipSurfaceClass = 'rounded-lg border border-border bg-[var(--popover)] px-2.5 py-2 text-xs shadow-[var(--shadow-raised)]'
