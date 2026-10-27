'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AVOID_LIMITS, AVOID_SPOT_RADIUS_M, expiryFor, isExpired, type AvoidReason, type AvoidSpot } from '@/domain/explore/avoidSpots'
import { appTodayIso } from '@/lib/calendarDate'
import { firestoreAvoidSpots, type AvoidSpotStore } from '@/lib/avoidSpots'
import { reportClientError } from '@/lib/reportClientError'
import { useOwnerAuth } from '@/lib/useOwnerAuth'

export interface AvoidSpots {
  /** Only the owner marks spots: Firestore refuses anyone else. */
  enabled: boolean
  /** None past its expiry: those are removed as they are read. */
  spots: readonly AvoidSpot[]
  /** The next tap on the map marks a spot instead of a start. */
  marking: boolean
  setMarking: (on: boolean) => void
  mark: (lngLat: [number, number]) => void
  remove: (id: string) => void
  setReason: (id: string, reason: AvoidReason | null) => void
  setRadius: (id: string, radiusM: number) => void
  /** The row tapped last: the map flies to it, and its row shows the radius. */
  selectedId: string | null
  /** A new value on every tap, the same row's included, so the map flies back to it after a pan. */
  located: { spot: AvoidSpot; tap: number } | null
  locate: (id: string) => void
  /** At the cap: Mark is off until one is removed. */
  full: boolean
  /** The last write did not reach Firestore. */
  failed: boolean
}

const NONE: readonly AvoidSpot[] = []

function failedWith(err: unknown) {
  console.warn('Avoid spots: a Firestore call failed')
  reportClientError('route', err)
}

export function useAvoidSpots(active: boolean, today: string = appTodayIso(), store: AvoidSpotStore = firestoreAvoidSpots): AvoidSpots {
  const owner = useOwnerAuth()
  const enabled = active && (owner.isOwner || store !== firestoreAvoidSpots)
  const [spots, setSpots] = useState<readonly AvoidSpot[]>(NONE)
  const [marking, setMarkingState] = useState(false)
  const [failed, setFailed] = useState(false)
  const [located, setLocated] = useState<{ id: string; tap: number } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let live = true
    store
      .read()
      .then((read) => {
        if (!live) return
        const expired = read.filter((spot) => isExpired(spot, today))
        setSpots(read.filter((spot) => !isExpired(spot, today)))
        for (const spot of expired) store.remove(spot.id).catch(failedWith)
      })
      .catch(failedWith)
    return () => {
      live = false
    }
  }, [enabled, today, store])

  const setMarking = useCallback((on: boolean) => setMarkingState(on), [])

  const full = spots.length >= AVOID_LIMITS.stored

  const mark = useCallback(
    (lngLat: [number, number]) => {
      setMarkingState(false)
      if (full) return
      store
        .add(lngLat, AVOID_SPOT_RADIUS_M)
        .then((spot) => {
          setFailed(false)
          setSpots((held) => [...held, spot])
        })
        .catch((err) => {
          setFailed(true)
          failedWith(err)
        })
    },
    [full, store],
  )

  const failWrite = useCallback((err: unknown) => {
    setFailed(true)
    failedWith(err)
  }, [])

  const remove = useCallback(
    (id: string) => {
      setSpots((held) => held.filter((spot) => spot.id !== id))
      setLocated((at) => (at?.id === id ? null : at))
      store.remove(id).catch(failWrite)
    },
    [store, failWrite],
  )

  const setReason = useCallback(
    (id: string, reason: AvoidReason | null) => {
      const expiresOn = expiryFor(reason, today)
      setSpots((held) => held.map((spot) => (spot.id === id ? { ...spot, reason, expiresOn } : spot)))
      store.setReason(id, reason, today).catch(failWrite)
    },
    [today, store, failWrite],
  )

  const setRadius = useCallback(
    (id: string, radiusM: number) => {
      setSpots((held) => held.map((spot) => (spot.id === id ? { ...spot, radiusM } : spot)))
      store.setRadius(id, radiusM).catch(failWrite)
    },
    [store, failWrite],
  )

  const locate = useCallback((id: string) => setLocated((at) => ({ id, tap: (at?.tap ?? 0) + 1 })), [])

  const shown = enabled ? spots : NONE
  const locatedSpot = useMemo(() => {
    const spot = located ? shown.find((s) => s.id === located.id) : undefined
    return spot && located ? { spot, tap: located.tap } : null
  }, [located, shown])

  return {
    enabled,
    spots: shown,
    marking: enabled && marking,
    setMarking,
    mark,
    remove,
    setReason,
    setRadius,
    selectedId: locatedSpot?.spot.id ?? null,
    located: locatedSpot,
    locate,
    full: enabled && full,
    failed,
  }
}
