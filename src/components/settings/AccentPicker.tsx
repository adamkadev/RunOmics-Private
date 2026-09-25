'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { t } from '@/i18n'
import {
  CURATED_ACCENTS,
  accentSwatchColor,
  persistAccent,
  snapHue,
  type AccentId,
  type AccentPreference,
} from '@/lib/accent'
import { useAccent } from '@/lib/useAccent'
import { useMounted } from '@/lib/useMounted'
import { AccentHueWheel } from './AccentHueWheel'
import { cn } from '@/lib/utils'

/** A ring with a gap of card between it and the swatch. */
const SELECTED_RING = '0 0 0 2px var(--card), 0 0 0 4px var(--foreground)'
/** Done commits a modal state, so it takes the app's chip fill rather than a link's colour. */
const COMMIT_FILL = '#3b82f6'

const DEFAULT_CUSTOM_HUE = snapHue(225)

export function AccentPicker() {
  const accent = useAccent()
  const mounted = useMounted()
  const [wheelOpen, setWheelOpen] = useState(false)

  const isCustom = mounted && accent.kind === 'custom'
  const customHue = accent.kind === 'custom' ? accent.hue : DEFAULT_CUSTOM_HUE

  function select(preference: AccentPreference) {
    persistAccent(preference)
  }

  function selectCurated(id: AccentId) {
    setWheelOpen(false)
    select({ kind: 'curated', id })
  }

  const selectedName = !mounted
    ? ''
    : accent.kind === 'custom'
      ? t.settings.accent.custom.hue(accent.hue)
      : t.settings.accent.options[accent.id].label

  return (
    <div>
      {/* R7f: a compact row - the name on the right, not a line of its own
          under the swatches, and no preview card. */}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-body font-semibold text-foreground">{t.settings.accent.title}</h3>
        <span className="min-h-4 text-footnote text-muted-foreground">{selectedName}</span>
      </div>

      {/* One row, never wrapped: five curated circles and the custom one. At
          44px the six of them fit the narrowest card we ship (375 pt screen). */}
      <div className="mt-3 flex flex-nowrap items-center justify-between gap-1.5">
        {CURATED_ACCENTS.map(({ id }) => {
          const active = mounted && accent.kind === 'curated' && accent.id === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectCurated(id)}
              aria-label={t.settings.accent.options[id].label}
              aria-pressed={active}
              style={{
                backgroundColor: accentSwatchColor({ kind: 'curated', id }),
                boxShadow: active ? SELECTED_RING : 'none',
              }}
              className="h-11 w-11 shrink-0 rounded-full transition-transform active:scale-90 sm:h-12 sm:w-12"
            />
          )
        })}

        {/* A dashed "+" until a custom hue is picked, then that hue. */}
        <button
          type="button"
          onClick={() => {
            if (!isCustom) select({ kind: 'custom', hue: DEFAULT_CUSTOM_HUE })
            setWheelOpen((open) => !open || !isCustom)
          }}
          aria-label={t.settings.accent.custom.open}
          aria-pressed={isCustom}
          aria-expanded={wheelOpen}
          style={isCustom ? { backgroundColor: accentSwatchColor({ kind: 'custom', hue: customHue }), boxShadow: SELECTED_RING } : undefined}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-transform active:scale-90 sm:h-12 sm:w-12',
            !isCustom && 'border border-dashed border-foreground/40',
          )}
        >
          {!isCustom && <Plus size={16} strokeWidth={2.4} />}
        </button>
      </div>

      {wheelOpen ? (
        <>
          <AccentHueWheel hue={customHue} onPick={(hue) => select({ kind: 'custom', hue })} />
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setWheelOpen(false)}
              className="min-h-[44px] px-6 text-sm font-semibold text-white active:scale-95"
              style={{ background: COMMIT_FILL, borderRadius: 12 }}
            >
              {t.settings.accent.custom.close}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
