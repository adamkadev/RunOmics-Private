'use client'

import { useEffect, useState } from 'react'
import type { MapTerritory } from '@/application/usecases/GetMapTerritory'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { reverseGeocode } from '@/lib/reverseGeocode'
import { t } from '@/i18n'

interface Props {
  territory: MapTerritory
  year: string
}

export function TerritoryBand({ territory, year }: Props) {
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
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent-text">
          {s.eyebrow(year)}
        </p>
        <p className="mt-2 text-base font-semibold leading-snug text-foreground">
          {s.headline(territory.percentVolume, territory.medianRadiusKm)}
          {place && <span className="text-accent-text"> {s.aroundPlace(place)}</span>}
        </p>
      </div>
      <div className="flex gap-6">
        <div>
          <div className="text-lg font-extrabold tabular-nums text-foreground">{territory.routeCount}</div>
          <div className="text-micro text-muted-foreground">{s.routesStat}</div>
        </div>
        <div>
          <div className="text-lg font-extrabold tabular-nums text-foreground">
            {territory.medianRadiusKm} {t.units.km}
          </div>
          <div className="text-micro text-muted-foreground">{s.radiusStat}</div>
        </div>
      </div>
    </GlassSurface>
  )
}
