'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { disablePushNotifications, enablePushNotifications, isPushSupported } from '@/lib/pushNotifications'
import { t } from '@/i18n'
import { cardClass } from '@/components/ui/Card'
import { Toast, useToast } from '@/components/ui/Toast'

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

  async function handleEnable() {
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

  async function handleDisable() {
    setStatus('disabling')
    try {
      await disablePushNotifications()
      setStatus('idle')
      showToast(t.settings.notifications.disabled, true)
    } catch {
      setStatus('enabled')
      showToast(t.settings.notifications.error, false)
    }
  }

  const n = t.settings.notifications

  return (
    <section className={cardClass({ padding: 'none' })}>
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{n.title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{n.subtitle}</p>
      </div>

      <div className="p-4 sm:p-5">
        {status === 'unsupported' && <p className="text-xs text-muted-foreground">{n.unsupported}</p>}
        {status === 'denied' && <p className="text-xs text-muted-foreground">{n.denied}</p>}
        {status === 'enabled' && <p className="mb-3 text-xs text-muted-foreground">{n.enabled}</p>}

        {(status === 'idle' || status === 'enabling') && (
          <button
            type="button"
            onClick={handleEnable}
            disabled={status === 'enabling'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Bell size={13} />
            {status === 'enabling' ? n.enabling : n.enable}
          </button>
        )}

        {(status === 'enabled' || status === 'disabling') && (
          <button
            type="button"
            onClick={handleDisable}
            disabled={status === 'disabling'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <BellOff size={13} />
            {n.disable}
          </button>
        )}
      </div>

      <Toast toast={toast} />
    </section>
  )
}
