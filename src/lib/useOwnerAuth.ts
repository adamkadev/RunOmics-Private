'use client'

import { useSyncExternalStore } from 'react'
import type { User } from 'firebase/auth'
import { isClientFirebaseConfigured } from '@/lib/firebaseConfig'
import { loadAuth } from '@/lib/loadAuth'

export interface OwnerAuth {
  user: User | null
  isOwner: boolean
  loading: boolean
}

const SIGNED_OUT: OwnerAuth = { user: null, isOwner: false, loading: false }
const UNKNOWN: OwnerAuth = isClientFirebaseConfigured ? { user: null, isOwner: false, loading: true } : SIGNED_OUT

let current = UNKNOWN
const listeners = new Set<() => void>()
let stop: (() => void) | undefined

function publish(next: OwnerAuth) {
  current = next
  for (const listener of listeners) listener()
}

function watch(): () => void {
  let latest = 0
  let stopped = false
  let unsubscribe: (() => void) | undefined
  // Loaded lazily: every visitor pays for the owner check, so it stays out of the first load.
  loadAuth()
    .then(({ auth, onIdTokenChanged }) => {
      if (stopped) return
      unsubscribe = onIdTokenChanged(auth, (user) => {
        const generation = ++latest
        if (!user) {
          publish(SIGNED_OUT)
          return
        }
        user
          .getIdTokenResult()
          .then((token) => {
            if (!stopped && generation === latest) publish({ user, isOwner: token.claims.owner === true, loading: false })
          })
          .catch(() => {
            if (!stopped && generation === latest) publish({ user, isOwner: false, loading: false })
          })
      })
    })
    .catch(() => {
      if (!stopped) publish(SIGNED_OUT)
    })
  return () => {
    stopped = true
    unsubscribe?.()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1 && isClientFirebaseConfigured) stop = watch()
  return () => {
    listeners.delete(listener)
    if (listeners.size > 0) return
    stop?.()
    stop = undefined
    current = UNKNOWN
  }
}

const snapshot = () => current
const serverSnapshot = () => UNKNOWN

/** Every owner-only part of a page shares one Firebase listener and one token read. */
export function useOwnerAuth(): OwnerAuth {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}
