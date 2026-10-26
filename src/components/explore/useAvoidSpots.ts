'use client'

import { useCallback, useEffect, useState } from 'react'
import { AVOID_LIMITS, type AvoidReason, type AvoidSpot } from '@/domain/explore/avoidSpots'
import { addAvoidSpot, deleteAvoidSpot, readAvoidSpots, setAvoidSpotReason } from '@/lib/avoidSpots'
import { reportClientError } from '@/lib/reportClientError'
import { useOwnerAuth } from '@/lib/useOwnerAuth'

export interface AvoidSpots {
  /** Only the owner marks spots: Firestore refuses anyone else. */
  enabled: boolean
  spots: readonly AvoidSpot[]
  /** The next tap on the map marks a spot instead of a start. */
  marking: boolean
  setMarking: (on: boolean) => void
  mark: (lngLat: [number, number]) => void
  remove: (id: string) => void
  setReason: (id: string, reason: AvoidReason | null) => void
  /** The last write did not reach Firestore. */
  failed: boolean
}

const NONE: readonly AvoidSpot[] = []

function failedWith(err: unknown) {
  console.warn('Avoid spots: a Firestore call failed')
  reportClientError('route', err)
}

export function useAvoidSpots(active: boolean): AvoidSpots {
  const owner = useOwnerAuth()
  const enabled = active && owner.isOwner
  const [spots, setSpots] = useState<readonly AvoidSpot[]>(NONE)
  const [marking, setMarkingState] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let live = true
    readAvoidSpots()
      .then((read) => {
        if (live) setSpots(read)
      })
      .catch(failedWith)
    return () => {
      live = false
    }
  }, [enabled])

  const setMarking = useCallback((on: boolean) => setMarkingState(on), [])

  const mark = useCallback(
    (lngLat: [number, number]) => {
      setMarkingState(false)
      if (spots.length >= AVOID_LIMITS.stored) return setFailed(true)
      addAvoidSpot(lngLat)
        .then((spot) => {
          setFailed(false)
          setSpots((held) => [...held, spot])
        })
        .catch((err) => {
          setFailed(true)
          failedWith(err)
        })
    },
    [spots.length],
  )

  const remove = useCallback((id: string) => {
    setSpots((held) => held.filter((spot) => spot.id !== id))
    deleteAvoidSpot(id).catch((err) => {
      setFailed(true)
      failedWith(err)
    })
  }, [])

  const setReason = useCallback((id: string, reason: AvoidReason | null) => {
    setSpots((held) => held.map((spot) => (spot.id === id ? { ...spot, reason } : spot)))
    setAvoidSpotReason(id, reason).catch((err) => {
      setFailed(true)
      failedWith(err)
    })
  }, [])

  return { enabled, spots: enabled ? spots : NONE, marking: enabled && marking, setMarking, mark, remove, setReason, failed }
}
