'use client'

import { useEffect, useState } from 'react'
import type { LonLat } from './workerProtocol'

export type RouteStartMode = 'here' | 'pick' | 'quartier'
export const ROUTE_START_MODES: readonly RouteStartMode[] = ['here', 'pick', 'quartier']

export type DeviceLocation = { status: 'locating' } | { status: 'ready'; point: LonLat } | { status: 'denied' } | { status: 'unavailable' }

export type RouteStartNote = 'locating' | 'denied' | 'unavailable' | 'pick'

export interface RouteStartState {
  mode: RouteStartMode
  /** Where the runner sets off; null starts inside the quartier. */
  origin: LonLat | null
  note: RouteStartNote | null
  /** No loop is asked for until the position or the tap is in. */
  waiting: boolean
}

const LOCATING: DeviceLocation = { status: 'locating' }
/** A street is close enough for a start, and a coarse fix comes faster indoors. */
const POSITION_OPTIONS: PositionOptions = { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 }

/** Asked once per `ask`, never watched: the start is where the run begins, not where the phone goes next. */
export function useDeviceLocation(ask: number | null): DeviceLocation | null {
  const [answer, setAnswer] = useState<{ ask: number; location: DeviceLocation } | null>(null)
  useEffect(() => {
    if (ask === null) return
    let alive = true
    const settle = (location: DeviceLocation) => {
      if (alive) setAnswer({ ask, location })
    }
    const geolocation = typeof navigator === 'undefined' ? undefined : navigator.geolocation
    if (!geolocation) {
      void Promise.resolve().then(() => settle({ status: 'unavailable' }))
    } else {
      geolocation.getCurrentPosition(
        ({ coords }) => settle({ status: 'ready', point: [coords.longitude, coords.latitude] }),
        (error) => settle({ status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
        POSITION_OPTIONS,
      )
    }
    return () => {
      alive = false
    }
  }, [ask])
  if (ask === null) return null
  return answer?.ask === ask ? answer.location : LOCATING
}

/** Without a position the loop starts inside the quartier, as before, and the note says why. */
export function routeStartState(mode: RouteStartMode, location: DeviceLocation | null, picked: LonLat | null): RouteStartState {
  if (mode === 'pick') return { mode, origin: picked, note: picked ? null : 'pick', waiting: !picked }
  if (mode === 'quartier') return { mode, origin: null, note: null, waiting: false }
  if (location?.status === 'ready') return { mode, origin: location.point, note: null, waiting: false }
  const status = location?.status ?? 'locating'
  return { mode, origin: null, note: status, waiting: status === 'locating' }
}
