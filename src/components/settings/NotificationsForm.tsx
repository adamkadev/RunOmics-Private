'use client'

import { useEffect, useState } from 'react'
import { disablePushNotifications, enablePushNotifications, isPushSupported } from '@/lib/pushNotifications'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Toast, useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

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

function Toggle({ enabled, busy, disabled: isDisabled, onToggle }: {
  enabled: boolean; busy: boolean; disabled: boolean; onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      disabled={isDisabled || busy}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full p-0 transition-colors disabled:opacity-40',
        'after:absolute after:-inset-[10px] after:content-[""]',
        enabled ? 'bg-accent' : 'bg-white/[0.12]'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform',
          enabled && 'translate-x-4'
        )}
      />
    </button>
  )
}

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

    if (status === 'idle') {
      setStatus('busy')
      try {
        await enablePushNotifications()
        const next = { ...prefs, [type]: true }
        setPrefs(next)
        savePrefs(next)
        setStatus('enabled')
      } catch {
        setStatus(Notification.permission === 'denied' ? 'denied' : 'idle')
        showToast(n.error, false)
      }
    }
  }

  const blocked = status === 'unsupported' || status === 'denied'
  const busy = status === 'loading' || status === 'busy'

  return (
    <GlassSurface variant="card" className="p-5">
      <h2 className="mb-4 text-sm font-bold text-foreground">{n.title}</h2>

      {blocked && (
        <p className="mb-3 text-xs text-muted-foreground">
          {status === 'unsupported' ? n.unsupported : n.denied}
        </p>
      )}

      <div className="space-y-4">
        {NOTIF_TYPES.map(({ key }) => {
          const strings = n.types[key]
          const enabled = status === 'enabled' && prefs[key]
          return (
            <div key={key} className="flex min-h-[44px] items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{strings.title}</p>
                <p className="text-xs text-muted-foreground">{strings.subtitle}</p>
              </div>
              <Toggle
                enabled={enabled}
                busy={busy}
                disabled={blocked}
                onToggle={() => handleToggle(key)}
              />
            </div>
          )
        })}
      </div>

      <Toast toast={toast} leaving={leaving} />
    </GlassSurface>
  )
}
