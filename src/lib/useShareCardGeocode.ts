'use client'

import { useEffect, useState } from 'react'
import type { Activity } from '@/domain/activity/types'

/**
 * Reverse-geocodes an activity's route (start / middle / end) into a city name
 * and up to three street names, for the share-card map/terrain designs.
 * Results are cached in sessionStorage so a card re-open doesn't re-hit
 * Nominatim.
 */
export function useShareCardGeocode(activity: Activity): {
  locationName: string | null
  streetLabels: string[]
} {
  const [locationName, setLocationName] = useState<string | null>(() => {
    try { return sessionStorage.getItem(`ro_geocode_${activity.id}`) } catch { return null }
  })
  const [streetLabels, setStreetLabels] = useState<string[]>(() => {
    try {
      const cached = sessionStorage.getItem(`ro_geocode_${activity.id}_roads`)
      return cached ? (JSON.parse(cached) as string[]) : []
    } catch { return [] }
  })

  useEffect(() => {
    if (locationName !== null && streetLabels.length > 0) return
    if (!activity.route || activity.route.length < 1) return
    const route = activity.route
    const cacheKey = `ro_geocode_${activity.id}`
    const indices = [...new Set([0, Math.floor(route.length * 0.5), route.length - 1])]
    Promise.allSettled(
      indices.map(idx => {
        const [lng, lat] = route[idx] ?? [0, 0]
        return fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`,
          { headers: { 'Accept-Language': 'fr', 'User-Agent': 'RunOmics/1.0' } }
        ).then(res => res.json()) as Promise<{ address?: Record<string, string> }>
      })
    ).then(results => {
      const roads: string[] = []
      let cityName: string | null = null
      for (const r of results) {
        if (r.status !== 'fulfilled') continue
        const addr = r.value.address ?? {}
        const road = addr.road ?? addr.pedestrian ?? addr.path ?? null
        if (road && !roads.includes(road)) roads.push(road)
        if (!cityName) {
          const suburb = addr.suburb ?? addr.neighbourhood
          const city = addr.city ?? addr.town ?? addr.village
          cityName = suburb ? `${suburb}, ${city}` : (city ?? null)
        }
      }
      if (roads.length > 0) {
        try { sessionStorage.setItem(`${cacheKey}_roads`, JSON.stringify(roads)) } catch { /* noop */ }
        setStreetLabels(roads)
      }
      if (cityName) {
        try { sessionStorage.setItem(cacheKey, cityName) } catch { /* noop */ }
        setLocationName(cityName)
      }
    })
  }, [activity.id, activity.route, locationName, streetLabels.length])

  return { locationName, streetLabels }
}
