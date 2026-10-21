'use client'

import { useEffect, useState } from 'react'
import { disablePushNotifications, enablePushNotifications, isPushSupported } from '@/lib/pushNotifications'
import { t } from '@/i18n'
import { Toast, useToast } from '@/components/ui/Toast'
import { Toggle } from '@/components/ui/Toggle'
import { useMounted } from '@/lib/useMounted'
import { dailyReminderTime } from './reminderTime'
import { GROUP_CARD, GROUP_ROW } from './settingsGroup'

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

  // The device's clock, so after mount: the server would read its own zone.
  const reminderAt = useMounted() ? dailyReminderTime(new Date(), process.env.NEXT_PUBLIC_TIME_ZONE || undefined) : null

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

  // One group of rows, a shared Toggle each (v4.17; 3.0 1i): the title alone,
  // and the daily reminder's time beside its switch. That time is read-only:
  // the workflow's schedule sets it, nothing here stores one.
  return (
    <>
    <section className={GROUP_CARD} data-testid="notifications-card">
      {NOTIF_TYPES.map(({ key }) => {
        const title = n.types[key].title
        const enabled = status === 'enabled' && prefs[key]
        return (
          <div key={key} className={GROUP_ROW}>
            <p className="min-w-0 text-sm text-foreground">{title}</p>
            <span className="flex shrink-0 items-center gap-3">
              {key === 'training' && reminderAt && (
                <span className="text-sm tabular-nums text-muted-foreground" data-testid="reminder-time">
                  {reminderAt}
                </span>
              )}
              <Toggle checked={enabled} disabled={busy} label={title} onChange={() => handleToggle(key)} />
            </span>
          </div>
        )
      })}
    </section>
    {/* Outside the group, so it is never taken for a row (F11). */}
    <Toast toast={toast} leaving={leaving} />
    </>
  )
}
