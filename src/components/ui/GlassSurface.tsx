import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import type { ElementType, HTMLAttributes } from 'react'

type GlassVariant = 'card' | 'chrome' | 'nav' | 'sheet' | 'chip' | 'hero'

const VARIANT_CLASS: Record<GlassVariant, string> = {
  card: 'glass-card',
  chrome: 'glass-nav',
  nav: 'glass-nav',
  sheet: 'glass-sheet',
  chip: 'glass-chip',
  hero: 'glass-hero',
}

interface GlassSurfaceProps extends HTMLAttributes<HTMLElement> {
  variant?: GlassVariant
  as?: ElementType
}

export const GlassSurface = forwardRef<HTMLElement, GlassSurfaceProps>(function GlassSurface(
  { variant = 'card', as: Tag = 'div', className, children, ...rest },
  ref
) {
  return (
    <Tag ref={ref} className={cn(VARIANT_CLASS[variant], className)} {...rest}>
      {children}
    </Tag>
  )
})
