'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

const STORAGE_KEY = 'ro-onboarding-seen'

export function FirstLaunchHint() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // A state initializer would read localStorage during the server render too
    // and trip a hydration mismatch; this hint only exists after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  if (!visible) return null

  const s = t.dashboard.onboarding

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <GlassSurface variant="card" className="flex items-start gap-3 p-4">
      <p className="flex-1 text-sm text-foreground/80">{s.message}</p>
      <button
        onClick={dismiss}
        aria-label={t.common.close}
        className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-95"
      >
        <X size={16} />
      </button>
    </GlassSurface>
  )
}
