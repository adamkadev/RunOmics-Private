import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import type { ElementType, HTMLAttributes } from 'react'

type GlassVariant = 'card' | 'chrome' | 'nav' | 'sheet' | 'chip' | 'hero'

const VARIANT_CLASS: Record<GlassVariant, string> = {
  card: 'glass-card',
  chrome: 'glass-chrome',
  nav: 'glass-nav',
  sheet: 'glass-sheet',
  chip: 'glass-chip',
  hero: 'glass-hero',
}

interface GlassSurfaceProps extends HTMLAttributes<HTMLElement> {
  variant?: GlassVariant
  as?: ElementType
}

/** Opaque content surfaces, despite the glass-* class names. */
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

/** Per role: regular chrome, the tab bar, clear over a map, a sheet. */
export type GlassMaterial = 'regular' | 'tab' | 'clear' | 'sheet'

const MATERIAL_CLASS: Record<GlassMaterial, string | undefined> = {
  regular: undefined,
  tab: 'lg-tab',
  clear: 'lg-clear',
  sheet: 'lg-sheet',
}

export function GlassLayers() {
  return (
    <>
      <i aria-hidden="true" className="lg-blur" />
      <i aria-hidden="true" className="lg-edge" />
      <i aria-hidden="true" className="lg-tint" />
    </>
  )
}

export function glassClass(material: GlassMaterial = 'regular', className?: string): string {
  return cn('lg', MATERIAL_CLASS[material], className)
}

type GlassProps = HTMLAttributes<HTMLElement> & {
  material?: GlassMaterial
  as?: ElementType
  [data: `data-${string}`]: string | undefined
}

/** Neither the .lg wrapper nor any ancestor may take a backdrop-filter, opacity, filter or mask, or WebKit flattens the blur. */
export const Glass = forwardRef<HTMLElement, GlassProps>(function Glass(
  { material = 'regular', as: Tag = 'div', className, children, ...rest },
  ref
) {
  return (
    <Tag ref={ref} className={glassClass(material, className)} {...rest}>
      <GlassLayers />
      {children}
    </Tag>
  )
})

export const GLASS_CIRCLE = 'hit-44 flex size-11 shrink-0 items-center justify-center text-foreground'

export const GLASS_GROUP_BUTTON = 'lg-press hit-44 flex h-11 w-[46px] items-center justify-center text-foreground'
