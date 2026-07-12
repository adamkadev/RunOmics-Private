'use client'

import { useEffect, useState } from 'react'
import type { Activity } from '@/domain/activity/types'

/**
 * Reverse-geocodes a handful of points evenly spaced along an activity's route
 * into a city name and a set of distinct street names, for the share-card
 * map/terrain designs. Results are cached in sessionStorage so a card re-open
 * doesn't re-hit Nominatim.
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
    // Sample evenly along the route so the map picks up several distinct
    // streets rather than repeating the same two or three names.
    const last = route.length - 1
    const indices = [...new Set(
      [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => Math.round(f * last))
    )]
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
