'use client'

import { useState } from 'react'
import { t } from '@/i18n'
import { PUSH_CATEGORIES, type PushCategories, type PushCategory } from '@/lib/pushCategories'
import { Toast, useToast } from '@/components/ui/Toast'
import { Toggle } from '@/components/ui/Toggle'
import { useMounted } from '@/lib/useMounted'
import { dailyReminderTime } from './reminderTime'
import { GROUP_CARD, GROUP_ROW } from './settingsGroup'

type PushStatus = 'loading' | 'unsupported' | 'idle' | 'busy' | 'enabled' | 'denied'

// The records key keeps its old name, so a phone that already chose keeps its switch.
const STORAGE_KEYS: Record<PushCategory, string> = {
  training: 'notif_training',
  shoes:    'notif_shoes',
  records:  'notif_races',
}

const ALL_OFF: PushCategories = { training: false, shoes: false, records: false }

/** A mirror for drawing the switches: the server reads the copy on the device's token, which a client cannot read back. */
function loadPrefs(): PushCategories {
  if (typeof window === 'undefined') return ALL_OFF
  return { training: stored('training'), shoes: stored('shoes'), records: stored('records') }
}

function stored(category: PushCategory): boolean {
  return localStorage.getItem(STORAGE_KEYS[category]) === 'true'
}

function savePrefs(prefs: PushCategories) {
  for (const category of PUSH_CATEGORIES) localStorage.setItem(STORAGE_KEYS[category], String(prefs[category]))
}

function canReceivePush(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function deviceStatus(): PushStatus {
  if (!canReceivePush()) return 'unsupported'
  const permission = Notification.permission
  return permission === 'granted' ? 'enabled' : permission === 'denied' ? 'denied' : 'idle'
}

const loadPush = () => import('@/lib/pushNotifications')

export function NotificationsForm() {
  // After mount: the server has no permission or storage to read, nor the athlete's time zone.
  const mounted = useMounted()
  const [changedStatus, setStatus] = useState<PushStatus | null>(null)
  const [chosenPrefs, setPrefs] = useState<PushCategories | null>(null)
  const status = changedStatus ?? (mounted ? deviceStatus() : 'loading')
  const prefs = chosenPrefs ?? (mounted && deviceStatus() === 'enabled' ? loadPrefs() : ALL_OFF)
  const { toast, leaving, showToast } = useToast()
  const n = t.settings.notifications

  const reminderAt = mounted ? dailyReminderTime(new Date(), process.env.NEXT_PUBLIC_TIME_ZONE || undefined) : null

  async function handleToggle(category: PushCategory) {
    if (status === 'enabled') {
      const next = { ...prefs, [category]: !prefs[category] }
      const allOff = PUSH_CATEGORIES.every((c) => !next[c])
      setPrefs(next)
      setStatus('busy')
      try {
        const push = await loadPush()
        if (allOff) await push.disablePushNotifications()
        else await push.savePushCategories(next)
        savePrefs(next)
        setStatus(allOff ? 'idle' : 'enabled')
      } catch {
        setStatus('enabled')
        setPrefs(prefs)
        showToast(n.error, false)
      }
      return
    }

    // Not enabled yet, whatever the reason: the tap is the permission request, and
    // the browser's own prompt is the only messaging needed.
    setStatus('busy')
    try {
      // Asked before the import: WebKit shows the prompt only while the tap's user activation lasts.
      if (canReceivePush() && (await Notification.requestPermission()) !== 'granted') throw new Error('permission-denied')
      const next = { ...prefs, [category]: true }
      await (await loadPush()).enablePushNotifications(next)
      setPrefs(next)
      savePrefs(next)
      setStatus('enabled')
    } catch {
      setStatus(typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'denied' : 'idle')
      showToast(n.error, false)
    }
  }

  const busy = status === 'loading' || status === 'busy'

  return (
    <>
    <section className={GROUP_CARD} data-testid="notifications-card">
      {PUSH_CATEGORIES.map((key) => {
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
    {/* Outside the group, so its separators never count it as a row. */}
    <Toast toast={toast} leaving={leaving} />
    </>
  )
}
