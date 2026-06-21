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

      <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2.5">
        {ACCENT_IDS.map((id) => {
          const { label, description } = t.settings.accent.options[id]
          const active = mounted && accent === id
          return (
            <button
              key={id}
              onClick={() => selectAccent(id)}
              aria-label={label}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center transition-colors sm:gap-1.5 sm:px-3 sm:py-3',
                active ? 'border-accent bg-accent-subtle' : 'border-border hover:bg-muted'
              )}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full sm:h-7 sm:w-7"
                style={{ backgroundColor: ACCENT_SWATCHES[id] }}
              >
                {active && <Check size={12} className="text-white sm:size-3.5" />}
              </span>
              <span className="hidden text-xs font-medium text-foreground sm:block">{label}</span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">{description}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
