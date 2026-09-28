'use client'

import { useEffect, useState } from 'react'
import { disablePushNotifications, enablePushNotifications, isPushSupported } from '@/lib/pushNotifications'
import { t } from '@/i18n'
import { cardClass } from '@/components/ui/Card'
import { Toast, useToast } from '@/components/ui/Toast'
import { Toggle } from '@/components/ui/Toggle'

type PushStatus = 'loading' | 'unsupported' | 'idle' | 'busy' | 'enabled' | 'denied'
type NotifType = 'training' | 'shoes' | 'races'

const STORAGE_KEYS: Record<NotifType, string> = {
  training: 'notif_training',
  shoes:    'notif_shoes',
  races:    'notif_races',
}

function loadPrefs(): Record<NotifType, boolean> {
  if (typeof window === 'undefined') return { training: false, shoes: false, races: false }
  return {
    training: localStorage.getItem(STORAGE_KEYS.training) === 'true',
    shoes:    localStorage.getItem(STORAGE_KEYS.shoes)    === 'true',
    races:    localStorage.getItem(STORAGE_KEYS.races)    === 'true',
  }
}

function savePrefs(prefs: Record<NotifType, boolean>) {
  for (const [key, val] of Object.entries(prefs)) {
    localStorage.setItem(STORAGE_KEYS[key as NotifType], String(val))
  }
}

const NOTIF_TYPES: { key: NotifType }[] = [
  { key: 'training' },
  { key: 'shoes' },
  { key: 'races' },
]

export function NotificationsForm() {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [prefs, setPrefs] = useState<Record<NotifType, boolean>>({ training: false, shoes: false, races: false })
  const { toast, leaving, showToast } = useToast()
  const n = t.settings.notifications

  useEffect(() => {
    isPushSupported().then((supported) => {
      if (!supported) { setStatus('unsupported'); return }
      const perm = Notification.permission
      if (perm === 'granted') {
        setStatus('enabled')
        setPrefs(loadPrefs())
      } else if (perm === 'denied') {
        setStatus('denied')
      } else {
        setStatus('idle')
      }
    })
  }, [])

  async function handleToggle(type: NotifType) {
    if (status === 'enabled') {
      const next = { ...prefs, [type]: !prefs[type] }
      setPrefs(next)
      savePrefs(next)
      const allOff = Object.values(next).every((v) => !v)
      if (allOff) {
        setStatus('busy')
        try {
          await disablePushNotifications()
          setStatus('idle')
        } catch {
          setStatus('enabled')
          setPrefs(prefs)
          showToast(n.error, false)
        }
      }
      return
    }

    // Not enabled yet, whatever the reason (never asked, previously denied, or
    // this browser turns out not to support it) - a toggle tap is the request.
    // The browser's own permission prompt is the only "blocked" messaging a
    // user needs; a persistent banner above it was redundant with UI it can't
    // act on.
    setStatus('busy')
    try {
      await enablePushNotifications()
      const next = { ...prefs, [type]: true }
      setPrefs(next)
      savePrefs(next)
      setStatus('enabled')
    } catch {
      setStatus(typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'denied' : 'idle')
      showToast(n.error, false)
    }
  }

  const busy = status === 'loading' || status === 'busy'

  // One card of rows, a shared Toggle each (v4.17): the section's eyebrow names it.
  return (
    <section className={cardClass({ padding: 'none', className: 'px-5' })} data-testid="notifications-card">
      {NOTIF_TYPES.map(({ key }) => {
        const strings = n.types[key]
        const enabled = status === 'enabled' && prefs[key]
        return (
          <div key={key} className="flex min-h-[44px] items-center justify-between gap-4 border-b border-border py-3.5 last:border-b-0">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{strings.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{strings.subtitle}</p>
            </div>
            <Toggle checked={enabled} disabled={busy} label={strings.title} onChange={() => handleToggle(key)} />
          </div>
        )
      })}

      <Toast toast={toast} leaving={leaving} />
    </section>
  )
}
