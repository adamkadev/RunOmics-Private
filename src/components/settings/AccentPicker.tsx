'use client'

import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { t } from '@/i18n'
import {
  CURATED_ACCENTS,
  HUE_STEP,
  HUE_STOPS,
  accentSwatchColor,
  isReservedHue,
  persistAccent,
  snapHue,
  type AccentId,
  type AccentPreference,
} from '@/lib/accent'
import { useAccent } from '@/lib/useAccent'
import { useMounted } from '@/lib/useMounted'
import { AccentHueWheel } from './AccentHueWheel'
import { cn } from '@/lib/utils'

const SELECTED_RING = 'var(--foreground)'
const CUSTOM_DOT = '#101a2c'
const PREVIEW_LABEL = 'var(--subtle-2)'
/** Done commits a modal state, so it takes the app's chip fill rather than a link's colour. */
const COMMIT_FILL = '#3b82f6'

/** The + swatch sweeps the hues it can actually give you; the band reads as a gap. */
const CUSTOM_SWEEP = HUE_STOPS.map((stop) => {
  const color = isReservedHue(stop) ? 'rgba(148,178,220,.14)' : accentSwatchColor({ kind: 'custom', hue: stop })
  return `${color} ${stop}deg ${stop + HUE_STEP}deg`
}).join(', ')

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
      <h3 className="text-body font-semibold text-foreground">{t.settings.accent.title}</h3>

      {/* One row, never wrapped: five curated circles and the custom one. At
          44px with a 6px gap the six of them need 294px, which fits the 301px
          the card leaves on the narrowest device we ship a splash for (375px,
          scripts/generate-splash.mjs). They take the design's 48px and 13px gap
          from `sm` up, where there is room for it. */}
      <div className="mt-4 flex flex-nowrap items-center justify-center gap-1.5 sm:gap-[13px]">
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
                boxShadow: active ? `0 0 0 2px ${SELECTED_RING}` : 'none',
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 sm:h-12 sm:w-12"
            >
              {active && <Check size={16} className="text-white drop-shadow-[0_1px_1.5px_var(--scrim-strong)]" />}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => {
            if (!isCustom) select({ kind: 'custom', hue: DEFAULT_CUSTOM_HUE })
            setWheelOpen((open) => !open || !isCustom)
          }}
          aria-label={t.settings.accent.custom.open}
          aria-pressed={isCustom}
          aria-expanded={wheelOpen}
          style={{
            background: `conic-gradient(from ${-HUE_STEP / 2}deg, ${CUSTOM_SWEEP})`,
            boxShadow: isCustom ? `0 0 0 2px ${SELECTED_RING}` : 'none',
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 sm:h-12 sm:w-12"
        >
          <span
            className="flex h-[17px] w-[17px] items-center justify-center rounded-full text-white"
            style={{ background: CUSTOM_DOT }}
          >
            <Plus size={11} strokeWidth={3} />
          </span>
        </button>
      </div>

      <p className="mt-2.5 min-h-4 text-center text-xs font-semibold text-foreground">{selectedName}</p>

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

      <div
        className={cn('mt-4 flex items-center gap-3 rounded-xl border p-3.5')}
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
        <span className="shrink-0 text-[12px] font-medium" style={{ color: PREVIEW_LABEL }}>
          {t.settings.accent.preview}
        </span>
      </div>
    </div>
  )
}
