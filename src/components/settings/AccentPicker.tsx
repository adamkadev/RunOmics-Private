'use client'

import { Check } from 'lucide-react'
import { t } from '@/i18n'
import { ACCENT_IDS, ACCENT_SWATCHES, persistAccent, type AccentId } from '@/lib/accent'
import { useAccent } from '@/lib/useAccent'
import { useMounted } from '@/lib/useMounted'

export function AccentPicker() {
  const accent = useAccent()
  const mounted = useMounted()

  function selectAccent(id: AccentId) {
    persistAccent(id)
  }

  return (
    <div>
      <h2 className="text-sm font-bold text-foreground">{t.settings.accent.title}</h2>

      <div
        className="mt-4 flex items-center gap-3 rounded-xl border p-3.5"
        style={{
          background: 'linear-gradient(135deg, var(--accent-subtle), transparent)',
          borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
        }}
      >
        <div
          className="h-[38px] w-[38px] shrink-0 rounded-full"
          style={{
            background: 'conic-gradient(var(--accent) 0deg 250deg, color-mix(in srgb, var(--foreground) 8%, transparent) 250deg 360deg)',
          }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 h-[7px] w-3/5 rounded-full bg-accent" />
          <div className="h-1.5 w-[85%] rounded-full bg-foreground/10" />
        </div>
        <span className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-micro font-semibold text-accent-foreground">
          {t.settings.accent.preview}
        </span>
      </div>

      {/* One row, never wrapped: `flex-wrap` used to orphan the last swatch onto a
          second row, centred under the other five. Five 44px targets and four 8px
          gaps need 252px; the narrowest device we ship a splash for is 375px wide
          (scripts/generate-splash.mjs), which leaves 301px inside main's px-4 and
          the card's p-5 + 1px border. A sixth accent would need 304px and no
          longer fit, so adding one means revisiting this row, not letting it wrap.
          A grid is wrong here: its tracks fill the container, so on desktop (a
          ~934px card) five circles would scatter across 180px columns. */}
      <div className="mt-4 flex flex-nowrap items-center justify-center gap-2">
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
              onKeyDown={(e) => {
                const idx = ACCENT_IDS.indexOf(id)
                if (e.key === 'ArrowRight') {
                  const next = ACCENT_IDS[(idx + 1) % ACCENT_IDS.length]
                  if (next) selectAccent(next)
                }
                if (e.key === 'ArrowLeft') {
                  const prev = ACCENT_IDS[(idx - 1 + ACCENT_IDS.length) % ACCENT_IDS.length]
                  if (prev) selectAccent(prev)
                }
              }}
              style={{
                backgroundColor: color,
                borderColor: active ? color : 'transparent',
                boxShadow: active ? `0 0 0 3px ${color}59` : 'none',
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-transform active:scale-90"
            >
              {active && <Check size={16} className="text-white drop-shadow-[0_1px_1.5px_var(--scrim-strong)]" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
