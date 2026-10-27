'use client'

import { useEffect } from 'react'
import { canReceivePush, hasPushPrefs, loadPrefs, setRegistrationFailed } from '@/lib/pushPrefs'
import { useMounted } from '@/lib/useMounted'
import { useOwnerAuth } from '@/lib/useOwnerAuth'

let refreshed = false

function isRegistered(): boolean {
  return canReceivePush() && Notification.permission === 'granted' && hasPushPrefs()
}

/** Loads no auth on a device that never turned pushes on, so every other visitor's first load stays as it was. */
export function PushTokenRefresh() {
  const mounted = useMounted()
  return mounted && isRegistered() ? <Refresh /> : null
}

function Refresh() {
  const { isOwner, loading } = useOwnerAuth()

  useEffect(() => {
    // The token document is the owner's to write: signed out, the stored switches wait for the next start.
    if (loading || !isOwner || refreshed) return
    refreshed = true
    import('@/lib/pushNotifications')
      .then((push) => push.refreshPushRegistration(loadPrefs()))
      .catch(() => setRegistrationFailed(true))
  }, [isOwner, loading])

  return null
}
