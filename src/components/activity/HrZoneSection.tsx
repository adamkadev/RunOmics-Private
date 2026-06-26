'use client'

import { useState } from 'react'
import type { HrZone } from '@/domain/activity/types'
import { HrChart } from './HrChart'
import { ZoneBar } from './ZoneBar'
import { t } from '@/i18n'

interface Props {
  hrSamples: number[]
  hrZones: HrZone[]
  avgHr?: number | null
  distanceKm?: number
  onHoverFraction?: (fraction: number | null) => void
}

export function HrZoneSection({ hrSamples, hrZones, avgHr, distanceKm, onHoverFraction }: Props) {
  const [activeZone, setActiveZone] = useState<number | null>(null)

  function handleZoneSelect(zone: number) {
    setActiveZone((prev) => (prev === zone ? null : zone))
  }

  return (
    <>
      <p className="widget-label text-muted-foreground">{t.activity.charts.sectionPhysiology}</p>
      <HrChart
        samples={hrSamples}
        avgHr={avgHr}
        distanceKm={distanceKm}
        onHoverFraction={onHoverFraction}
        highlightZone={activeZone}
        hrZones={hrZones}
      />
      {hrZones.length > 0 && (
        <ZoneBar
          hrZones={hrZones}
          activeZone={activeZone}
          onZoneSelect={handleZoneSelect}
        />
      )}
    </>
  )
}
