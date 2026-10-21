'use client'

import { usePathname } from 'next/navigation'
import { useGlow } from '@/lib/glow'

/** A page's three colours, as CSS custom properties: the field's three glows. */
type Palette = readonly [string, string, string]

/**
 * Each page's aura (Liquid Glass v3, G14, README §6.11). Pages with a map
 * hero - an activity, the map, the share card - have the map itself, and the
 * rest none.
 */
const PALETTES: Record<string, Palette> = {
  '/': ['--accent', '--zone-2', '--zone-3'],
  '/activities': ['--accent', '--zone-2', '--zone-1'],
  '/plan': ['--zone-4', '--zone-2', '--accent'],
  '/analytics': ['--zone-2', '--zone-3', '--accent'],
  '/profile': ['--accent', '--zone-3', '--warn'],
  '/records': ['--warn', '--accent', '--zone-3'],
  '/consistency': ['--accent', '--zone-2', '--accent'],
  '/athlete': ['--zone-2', '--zone-4', '--accent'],
  '/athlete/vo2max': ['--accent', '--zone-3', '--zone-2'],
  '/goals': ['--accent', '--warn', '--zone-2'],
  '/settings': ['--zone-1', '--accent', '--zone-3'],
}

export function auraPalette(pathname: string): Palette | null {
  return PALETTES[pathname.replace(/\/+$/, '') || '/'] ?? null
}

/**
 * The aura: a blurred colour field behind the top of the page, from the
 * page's palette. A sibling under the content, never an ancestor of glass
 * (its filter would make it a backdrop root). In light it sits under frosted
 * cards; in dark it is shown at half strength and only tints the header.
 * The Background glow switch turns it off in both themes (round 2, F2), and
 * Reduce Transparency and Increase Contrast hide it (globals.css).
 */
export function Aura() {
  const palette = auraPalette(usePathname())
  const glow = useGlow()
  if (!palette || !glow) return null
  const [c1, c2, c3] = palette
  return (
    <div
      aria-hidden="true"
      data-testid="aura"
      className="aura"
      style={{ '--aura-1': `var(${c1})`, '--aura-2': `var(${c2})`, '--aura-3': `var(${c3})` } as React.CSSProperties}
    />
  )
}
