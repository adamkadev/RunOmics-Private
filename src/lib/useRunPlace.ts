'use client'

import { useEffect, useState } from 'react'
import { t } from '@/i18n'
import { useMounted } from '@/lib/useMounted'

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
  /** The town: the share card's "Sat, Sep 26 · Hoenheim". */
  town: string | null
  /** The quartier inside it, when the address has one: "Robertsau". */
  quartier: string | null
}

const NONE: RunPlace = { town: null, quartier: null }

export function runPlace(address: NominatimAddress | undefined): RunPlace {
  if (!address) return NONE
  const town = address.city ?? address.town ?? address.village ?? address.municipality ?? null
  const quartier = address.suburb ?? address.quarter ?? address.city_district ?? address.neighbourhood ?? null
  return { town: town ?? quartier, quartier: quartier && quartier !== town ? quartier : null }
}

/** The start's town, for the share card. */
export function placeName(address: NominatimAddress | undefined): string | null {
  return runPlace(address).town
}

const cacheKey = (id: string) => `ro_runplace_${id}`

function readCache(id: string): RunPlace | null {
  try {
    const raw = localStorage.getItem(cacheKey(id))
    return raw ? (JSON.parse(raw) as RunPlace) : null
  } catch {
    return null
  }
}

/**
 * Where a run started: one reverse geocode of its first point, at street
 * grain so the address carries the quartier as well as the town, kept per
 * run in this browser. The map's own labels only name a quartier when
 * zoomed right in, so the header and the share card read it from here.
 */
export function useRunPlace(activityId: string, start: [number, number] | null | undefined): RunPlace {
  // Read after mount: the server has no storage, and a cached name drawn on
  // the first render would not match its HTML (React #418).
  const mounted = useMounted()
  const cached = mounted ? readCache(activityId) : null
  const [fetched, setFetched] = useState<{ id: string; place: RunPlace } | null>(null)
  const place = cached ?? (fetched?.id === activityId ? fetched.place : null)

  const known = place !== null

  useEffect(() => {
    if (!mounted || known) return
    if (!start) return
    const [lng, lat] = start
    let alive = true
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`, {
      headers: { 'Accept-Language': t.locale },
    })
      .then((res) => res.json() as Promise<{ address?: NominatimAddress }>)
      .then((body) => {
        const found = runPlace(body.address)
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
