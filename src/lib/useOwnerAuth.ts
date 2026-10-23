'use client'

import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { isClientFirebaseConfigured } from '@/lib/firebaseConfig'

export interface OwnerAuth {
  user: User | null
  isOwner: boolean
  loading: boolean
}

const SIGNED_OUT: OwnerAuth = { user: null, isOwner: false, loading: false }

export function useOwnerAuth(): OwnerAuth {
  const [auth, setAuth] = useState<OwnerAuth>(
    isClientFirebaseConfigured ? { user: null, isOwner: false, loading: true } : SIGNED_OUT
  )

  useEffect(() => {
    if (!isClientFirebaseConfigured) return

    let latest = 0
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    // Loaded lazily: every visitor pays for the owner check, so it stays out of the first load.
    Promise.all([import('firebase/auth'), import('@/lib/firebase')])
      .then(([{ onIdTokenChanged }, { getClientAuth }]) => {
        if (cancelled) return
        unsubscribe = onIdTokenChanged(getClientAuth(), (user) => {
          const generation = ++latest
          if (!user) {
            setAuth(SIGNED_OUT)
            return
          }
          user
            .getIdTokenResult()
            .then((token) => {
              if (generation === latest) {
                setAuth({ user, isOwner: token.claims.owner === true, loading: false })
              }
            })
            .catch(() => {
              if (generation === latest) setAuth({ user, isOwner: false, loading: false })
            })
        })
      })
      .catch(() => {
        if (!cancelled) setAuth(SIGNED_OUT)
      })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  return auth
}
