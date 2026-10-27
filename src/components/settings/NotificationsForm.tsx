'use client'

import { useState, useSyncExternalStore } from 'react'
import { t } from '@/i18n'
import { PUSH_CATEGORIES, type PushCategories, type PushCategory } from '@/lib/pushCategories'
import { ALL_OFF, canReceivePush, loadPrefs, registrationFailed, savePrefs, subscribeRegistration } from '@/lib/pushPrefs'
import { Toast, useToast } from '@/components/ui/Toast'
import { Toggle } from '@/components/ui/Toggle'
import { useMounted } from '@/lib/useMounted'
import { dailyReminderTime } from './reminderTime'
import { GROUP_CARD, GROUP_ROW } from './settingsGroup'

type PushStatus = 'loading' | 'unsupported' | 'idle' | 'busy' | 'enabled' | 'denied'

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
  const unregistered = useSyncExternalStore(subscribeRegistration, registrationFailed, () => false)

  const reminderAt = mounted ? dailyReminderTime(new Date(), process.env.NEXT_PUBLIC_TIME_ZONE || undefined) : null

  async function handleToggle(category: PushCategory) {
    if (status === 'busy') return
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

    // Not enabled yet: the tap is the permission request.
    const next = { ...prefs, [category]: true }
    setPrefs(next)
    setStatus('busy')
    try {
      // Asked before the import: WebKit shows the prompt only while the tap's user activation lasts.
      if (canReceivePush() && (await Notification.requestPermission()) !== 'granted') throw new Error('permission-denied')
      await (await loadPush()).enablePushNotifications(next)
      savePrefs(next)
      setStatus('enabled')
    } catch {
      setPrefs(prefs)
      const blocked = typeof Notification !== 'undefined' && Notification.permission === 'denied'
      setStatus(blocked ? 'denied' : 'idle')
      if (!blocked) showToast(n.error, false)
    }
  }

  const blockedHint = status === 'unsupported' ? n.unsupported : status === 'denied' ? n.denied : null


  return (
    <>
    <section className={GROUP_CARD} data-testid="notifications-card">
      {PUSH_CATEGORIES.map((key) => {
        const title = n.types[key].title
        // While a tap saves, every switch keeps drawing its own state, the tapped one already at its new one.
        const enabled = (status === 'enabled' || status === 'busy') && prefs[key]
        return (
          <div key={key} className={GROUP_ROW}>
            <p className="min-w-0 text-sm text-foreground">{title}</p>
            <span className="flex shrink-0 items-center gap-3">
              {key === 'training' && reminderAt && (
                <span className="text-sm tabular-nums text-muted-foreground" data-testid="reminder-time">
                  {reminderAt}
                </span>
              )}
              <Toggle checked={enabled} disabled={status === 'loading' || blockedHint !== null} label={title} onChange={() => handleToggle(key)} />
            </span>
          </div>
        )
      })}
    </section>
    {blockedHint && (
      <p className="px-4 text-xs leading-snug text-muted-foreground" data-testid="push-blocked">
        {blockedHint}
      </p>
    )}
    {status === 'enabled' && unregistered && (
      <p className="px-4 text-xs leading-snug text-[var(--neg)]" data-testid="push-unregistered">
        {n.notRegistered}
      </p>
    )}
    {/* Outside the group, so its separators never count it as a row. */}
    <Toast toast={toast} leaving={leaving} />
    </>
  )
}
