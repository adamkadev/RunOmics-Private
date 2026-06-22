import { cn } from '@/lib/utils'
import type { ElementType, HTMLAttributes } from 'react'

type GlassVariant = 'card' | 'nav' | 'sheet' | 'chip'

const VARIANT_CLASS: Record<GlassVariant, string> = {
  card: 'glass-card',
  nav: 'glass-nav',
  sheet: 'glass-sheet',
  chip: 'glass-chip',
}

interface GlassSurfaceProps extends HTMLAttributes<HTMLElement> {
  variant?: GlassVariant
  as?: ElementType
}

/**
 * Liquid glass surface: translucent background + backdrop blur + beveled
 * highlight, adapting to the theme via the `--glass-*` tokens. Use sparingly
 * (<= ~6 blurred surfaces per viewport) - backdrop-filter is GPU-costly.
 */
export function GlassSurface({
  variant = 'card',
  as: Tag = 'div',
  className,
  children,
  ...rest
}: GlassSurfaceProps) {
  return (
    <Tag className={cn(VARIANT_CLASS[variant], className)} {...rest}>
      {children}
    </Tag>
  )
}
