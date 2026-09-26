'use client'

import { useEffect, useState } from 'react'
import type { ShareActivity } from '@/lib/shareCardStats'
import { t } from '@/i18n'

interface NominatimAddress {
  city?: string
  town?: string
  village?: string
  municipality?: string
  suburb?: string
}

/** The town a run started in, for the card's "Sat, Sep 26 · Hoenheim". */
export function placeName(address: NominatimAddress | undefined): string | null {
  if (!address) return null
  return address.city ?? address.town ?? address.village ?? address.municipality ?? address.suburb ?? null
}

export function useShareCardGeocode(activity: ShareActivity): { locationName: string | null } {
  const cacheKey = `ro_place_${activity.id}`
  const [locationName, setLocationName] = useState<string | null>(() => {
    try { return sessionStorage.getItem(cacheKey) } catch { return null }
  })

  useEffect(() => {
    if (locationName !== null) return
    const start = activity.route?.[0]
    if (!start) return
    const [lng, lat] = start
    let alive = true
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=12`,
      { headers: { 'Accept-Language': t.locale, 'User-Agent': 'RunOmics/1.0' } },
    )
      .then((res) => res.json() as Promise<{ address?: NominatimAddress }>)
      .then((body) => {
        const place = placeName(body.address)
        if (!place || !alive) return
        try { sessionStorage.setItem(cacheKey, place) } catch {}
        setLocationName(place)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [activity.route, cacheKey, locationName])

  return { locationName }
}
