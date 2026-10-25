'use client'

import { usePathname } from 'next/navigation'
import { useGlow } from '@/lib/glow'
import { useUrlParam } from '@/lib/useUrlParam'

/** CSS custom property names, one per glow. */
type Palette = readonly [string, string, string]

const TODAY: Palette = ['--accent', '--zone-2', '--zone-3']

/** Pages with a map hero (an activity, the map, the share card) have none, and nor has Activities' Map view. */
const PALETTES: Record<string, Palette> = {
  '/': TODAY,
  '/activities': ['--accent', '--zone-2', '--zone-1'],
  '/plan': ['--zone-4', '--zone-2', '--accent'],
  '/analytics': ['--zone-2', '--zone-3', '--accent'],
  '/profile': ['--accent', '--zone-3', '--warn'],
  '/records': ['--warn', '--accent', '--zone-3'],
  '/consistency': ['--accent', '--zone-2', '--accent'],
  '/all-time': ['--zone-3', '--accent', '--zone-2'],
  '/athlete': ['--zone-2', '--zone-4', '--accent'],
  '/athlete/vo2max': ['--accent', '--zone-3', '--zone-2'],
  '/goals': ['--accent', '--warn', '--zone-2'],
  '/race': ['--accent', '--warn', '--zone-2'],
  '/settings': ['--zone-1', '--accent', '--zone-3'],
  // A Progress page, as Records.
  '/shoes': ['--warn', '--accent', '--zone-3'],
}

/** Pages whose children take their palette. */
const FAMILIES = ['/shoes', '/plan']

export function auraPalette(pathname: string, view: string | null = null): Palette | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path.startsWith('/activities/') || (path === '/activities' && view === 'map')) return null
  const family = FAMILIES.find((root) => path.startsWith(`${root}/`))
  return PALETTES[path] ?? (family ? PALETTES[family] : undefined) ?? TODAY
}

/**
 * A sibling under the content, never an ancestor of glass: its filter would make it a backdrop root.
 * Reduce Transparency and Increase Contrast hide it (globals.css).
 */
export function Aura() {
  const [view] = useUrlParam('view')
  const palette = auraPalette(usePathname(), view)
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
