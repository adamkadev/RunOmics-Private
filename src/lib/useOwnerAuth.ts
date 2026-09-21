'use client'

import { useEffect, useState } from 'react'
import { onIdTokenChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { getClientAuth, isClientFirebaseConfigured } from '@/lib/firebase'

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
    return onIdTokenChanged(getClientAuth(), (user) => {
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
  }, [])

  return auth
}
