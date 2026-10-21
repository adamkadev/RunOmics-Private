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

/** The content layer's opaque surfaces (the class names are the old glass ones). */
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

/** Liquid Glass v3's material per role: regular chrome, the tab bar, over a map, a sheet. */
export type GlassMaterial = 'regular' | 'tab' | 'clear' | 'sheet'

const MATERIAL_CLASS: Record<GlassMaterial, string | undefined> = {
  regular: undefined,
  tab: 'lg-tab',
  clear: 'lg-clear',
  sheet: 'lg-sheet',
}

/** The glass object's three sibling layers, for a wrapper drawn by hand. */
export function GlassLayers() {
  return (
    <>
      <i aria-hidden="true" className="lg-blur" />
      <i aria-hidden="true" className="lg-edge" />
      <i aria-hidden="true" className="lg-tint" />
    </>
  )
}

/** `.lg` and its material, for a wrapper drawn by hand around <GlassLayers />. */
export function glassClass(material: GlassMaterial = 'regular', className?: string): string {
  return cn('lg', MATERIAL_CLASS[material], className)
}

type GlassProps = HTMLAttributes<HTMLElement> & {
  material?: GlassMaterial
  as?: ElementType
  /** data-* hooks (data-testid, data-pressed) pass straight through. */
  [data: `data-${string}`]: string | undefined
}

/**
 * The Liquid Glass object (G1): the `.lg` wrapper with its blur, edge-band
 * and tint layers as siblings, then the content. The wrapper itself never
 * takes a backdrop-filter, an opacity, a filter or a mask - nor may any of
 * its ancestors - or WebKit flattens the blur. Only navigation chrome is
 * glass: the tab bar, the bar's buttons, controls over a map, a
 * medium-detent sheet. Controls inside a glass sheet use fills, never glass.
 */
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

/** A 44 pt glass circle's geometry: a bar button, a map control. */
export const GLASS_CIRCLE = 'hit-44 flex size-11 shrink-0 items-center justify-center text-foreground'

/**
 * One button of a glass group (G13: the hero's expand + share in a single
 * 44 pt capsule, 46 pt each). The buttons are plain; the group swells.
 */
export const GLASS_GROUP_BUTTON = 'lg-press hit-44 flex h-11 w-[46px] items-center justify-center text-foreground'
