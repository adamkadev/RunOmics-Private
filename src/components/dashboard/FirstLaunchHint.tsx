'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

const STORAGE_KEY = 'ro-onboarding-seen'

export function FirstLaunchHint() {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && !!window.localStorage.getItem(STORAGE_KEY)
  )

  if (dismissed) return null

  const s = t.dashboard.onboarding

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, '1')
    setDismissed(true)
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
