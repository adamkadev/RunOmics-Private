'use client'

import { useEffect, useState } from 'react'
import type { MapTerritory } from '@/application/usecases/GetMapTerritory'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { t } from '@/i18n'

// The accent-text token drops to a dark 600 tone in light mode; on this always-
// dark hero surface it needs the on-dark value, held in both modes.
const ACCENT_ON_DARK = 'var(--accent-on-dark)'

interface Props {
  territory: MapTerritory
}

export function TerritoryBand({ territory }: Props) {
  const s = t.pages.map.territory
  const [place, setPlace] = useState<string | null>(null)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
    if (!token) return
    let cancelled = false
    reverseGeocode(territory.center[0], territory.center[1], token).then((name) => {
      if (!cancelled) setPlace(name)
    })
    return () => {
      cancelled = true
    }
  }, [territory.center])

  return (
    <GlassSurface variant="hero" className="flex flex-col gap-3.5">
      {/* variant="hero" paints --hero-gradient: deep in light, a subtle tint in
          dark - a dark surface in both modes. So its text uses white / --accent-
          on-dark, never text-foreground (which is dark in light and vanishes
          here) - same rule as TodayHero and ProfileHero. */}
      <div>
        <p className="font-mono text-micro font-bold uppercase tracking-[0.1em]" style={{ color: ACCENT_ON_DARK }}>
          {s.eyebrow}
        </p>
        <p className="mt-2 font-display text-base font-bold leading-snug text-white">
          {s.headline(territory.percentVolume, territory.medianRadiusKm)}
          {place && <span style={{ color: ACCENT_ON_DARK }}> {s.aroundPlace(place)}</span>}
        </p>
      </div>
      <div className="flex gap-6">
        <div>
          <div className="font-display text-lg font-bold tabular-nums text-white">{territory.routeCount}</div>
          <div className="text-micro text-white/60">{s.routesStat}</div>
        </div>
        <div>
          <div className="font-display text-lg font-bold tabular-nums text-white">
            {territory.medianRadiusKm} {t.units.km}
          </div>
          <div className="text-micro text-white/60">{s.radiusStat}</div>
        </div>
      </div>
    </GlassSurface>
  )
}
