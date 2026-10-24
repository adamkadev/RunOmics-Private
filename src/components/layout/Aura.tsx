'use client'

import { usePathname } from 'next/navigation'
import { useGlow } from '@/lib/glow'

/** CSS custom property names, one per glow. */
type Palette = readonly [string, string, string]

const TODAY: Palette = ['--accent', '--zone-2', '--zone-3']

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
  '/settings': ['--zone-1', '--accent', '--zone-3'],
  // A Progress page, as Records.
  '/shoes': ['--warn', '--accent', '--zone-3'],
}

/** Pages whose children take their palette. */
const FAMILIES = ['/activities', '/shoes']

function normalize(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/'
}

export function auraPalette(pathname: string): Palette {
  const path = normalize(pathname)
  const family = FAMILIES.find((root) => path.startsWith(`${root}/`))
  return PALETTES[path] ?? (family ? PALETTES[family] : undefined) ?? TODAY
}

/** An activity opens on a full-bleed map (RunMapHero), which would hide a glow at the top. */
export function auraUnderHero(pathname: string): boolean {
  return normalize(pathname).startsWith('/activities/')
}

/**
 * A sibling under the content, never an ancestor of glass: its filter would make it a backdrop root.
 * Reduce Transparency and Increase Contrast hide it (globals.css).
 */
export function Aura() {
  const pathname = usePathname()
  const [c1, c2, c3] = auraPalette(pathname)
  const glow = useGlow()
  if (!glow) return null
  return (
    <div
      aria-hidden="true"
      data-testid="aura"
      data-under-hero={auraUnderHero(pathname) || undefined}
      className="aura"
      style={{ '--aura-1': `var(${c1})`, '--aura-2': `var(${c2})`, '--aura-3': `var(${c3})` } as React.CSSProperties}
    />
  )
}
