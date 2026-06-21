'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { ACCENT_IDS, ACCENT_SWATCHES, persistAccent, type AccentId } from '@/lib/accent'
import { useAccent } from '@/lib/useAccent'

export function AccentPicker() {
  const accent = useAccent()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  function selectAccent(id: AccentId) {
    persistAccent(id)
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">{t.settings.accent.title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{t.settings.accent.subtitle}</p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {ACCENT_IDS.map((id) => {
          const { label, description } = t.settings.accent.options[id]
          const active = mounted && accent === id
          return (
            <button
              key={id}
              onClick={() => selectAccent(id)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center transition-colors',
                active ? 'border-accent bg-accent-subtle' : 'border-border hover:bg-muted'
              )}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full"
                style={{ backgroundColor: ACCENT_SWATCHES[id] }}
              >
                {active && <Check size={14} className="text-white" />}
              </span>
              <span className="text-xs font-medium text-foreground">{label}</span>
              <span className="text-[11px] text-muted-foreground">{description}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
