'use client'

import { useEffect, useState } from 'react'
import { t } from '@/i18n'
import { useMounted } from '@/lib/useMounted'
import { townAt } from '@/lib/reverseGeocode'

export interface NominatimAddress {
  city?: string
  town?: string
  village?: string
  municipality?: string
  suburb?: string
  city_district?: string
  quarter?: string
  neighbourhood?: string
}

export interface RunPlace {
  town: string | null
  quartier: string | null
}

const NONE: RunPlace = { town: null, quartier: null }

export function runPlace(address: NominatimAddress | undefined): RunPlace {
  if (!address) return NONE
  const town = address.city ?? address.town ?? address.village ?? address.municipality ?? null
  const quartier = address.suburb ?? address.quarter ?? address.city_district ?? address.neighbourhood ?? null
  return { town: town ?? quartier, quartier: quartier && quartier !== town ? quartier : null }
}

/** v2: the town from MapTiler; a v1 entry from Nominatim could name the town over a border. */
const cacheKey = (id: string) => `ro_runplace_v2_${id}`

function readCache(id: string): RunPlace | null {
  try {
    const raw = localStorage.getItem(cacheKey(id))
    return raw ? (JSON.parse(raw) as RunPlace) : null
  } catch {
    return null
  }
}

/** MapTiler's town at about 110 m, as the share card's map; Nominatim's, at about a kilometre, without one. */
async function lookUpPlace(start: [number, number]): Promise<RunPlace> {
  const token = process.env.NEXT_PUBLIC_MAPTILER_TOKEN
  const town = token ? await townAt(start[0], start[1], token) : null
  if (town) return { town, quartier: null }
  const [lng, lat] = start.map((value) => value.toFixed(2))
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`, {
    headers: { 'Accept-Language': t.locale },
  })
  return runPlace(((await res.json()) as { address?: NominatimAddress }).address)
}

export function useRunPlace(activityId: string, start: [number, number] | null | undefined): RunPlace {
  // Read after mount: a cached name drawn on the first render would not match the server's HTML.
  const mounted = useMounted()
  const cached = mounted ? readCache(activityId) : null
  const [fetched, setFetched] = useState<{ id: string; place: RunPlace } | null>(null)
  const place = cached ?? (fetched?.id === activityId ? fetched.place : null)

  const known = place !== null

  useEffect(() => {
    if (!mounted || known) return
    if (!start) return
    let alive = true
    lookUpPlace(start)
      .then((found) => {
        if (!alive || (!found.town && !found.quartier)) return
        try { localStorage.setItem(cacheKey(activityId), JSON.stringify(found)) } catch {}
        setFetched({ id: activityId, place: found })
      })
      .catch(() => {})
    return () => { alive = false }
    // start is the run's first point; the id names the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId, mounted, known])

  return place ?? NONE
}
