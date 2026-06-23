'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
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
    <div>
      <h2 className="text-sm font-bold text-foreground">{t.settings.accent.title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{t.settings.accent.subtitle}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        {ACCENT_IDS.map((id) => {
          const { label } = t.settings.accent.options[id]
          const color = ACCENT_SWATCHES[id]
          const active = mounted && accent === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectAccent(id)}
              aria-label={label}
              aria-pressed={active}
              style={{
                backgroundColor: color,
                borderColor: active ? color : 'transparent',
                boxShadow: active ? `0 0 0 3px ${color}59` : 'none',
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-transform active:scale-90"
            >
              {active && <Check size={18} className="text-white drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.6)]" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
