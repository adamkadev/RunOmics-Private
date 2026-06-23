'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { disablePushNotifications, enablePushNotifications, isPushSupported } from '@/lib/pushNotifications'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { Toast, useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

type Status = 'loading' | 'unsupported' | 'idle' | 'enabling' | 'enabled' | 'disabling' | 'denied'

export function NotificationsForm() {
  const [status, setStatus] = useState<Status>('loading')
  const { toast, showToast } = useToast()

  useEffect(() => {
    isPushSupported().then((supported) => {
      if (!supported) {
        setStatus('unsupported')
        return
      }
      setStatus(Notification.permission === 'granted' ? 'enabled' : Notification.permission === 'denied' ? 'denied' : 'idle')
    })
  }, [])

  async function handleToggle() {
    if (status === 'enabled') {
      setStatus('disabling')
      try {
        await disablePushNotifications()
        setStatus('idle')
        showToast(t.settings.notifications.disabled, true)
      } catch {
        setStatus('enabled')
        showToast(t.settings.notifications.error, false)
      }
      return
    }

    setStatus('enabling')
    try {
      await enablePushNotifications()
      setStatus('enabled')
      showToast(t.settings.notifications.success, true)
    } catch {
      setStatus(Notification.permission === 'denied' ? 'denied' : 'idle')
      showToast(t.settings.notifications.error, false)
    }
  }

  const n = t.settings.notifications
  const busy = status === 'loading' || status === 'enabling' || status === 'disabling'
  const enabled = status === 'enabled' || status === 'disabling'
  const description =
    status === 'unsupported' ? n.unsupported :
    status === 'denied'      ? n.denied :
    enabled                  ? n.enabled :
    n.subtitle

  return (
    <GlassSurface variant="card" className="rounded-[22px] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bell size={16} className="shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">{n.title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          disabled={busy || status === 'unsupported' || status === 'denied'}
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50',
            enabled ? 'bg-accent' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform',
              enabled && 'translate-x-4'
            )}
          />
        </button>
      </div>

      <Toast toast={toast} />
    </GlassSurface>
  )
}
