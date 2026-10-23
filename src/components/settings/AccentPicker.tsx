'use client'

import { useTheme } from 'next-themes'
import { t } from '@/i18n'
import { CURATED_ACCENTS, persistAccent } from '@/lib/accent'
import { useAccent } from '@/lib/useAccent'
import { useMounted } from '@/lib/useMounted'

/** The idle hairline gives Mono's white swatch an edge on a light card. */
const RING = {
  selected: '0 0 0 2px var(--card), 0 0 0 4px var(--foreground)',
  idle: 'inset 0 0 0 1px var(--line-2)',
}

/**
 * No custom hue: it could land on the zone and status colours. On a phone the
 * swatches sit at least 44 pt apart so their hit-44 targets never overlap.
 */
export function AccentPicker() {
  const accent = useAccent()
  const mounted = useMounted()
  const { resolvedTheme } = useTheme()
  const mode = mounted && resolvedTheme === 'light' ? 'light' : 'dark'

  return (
    <div className="flex flex-nowrap items-center gap-4 sm:gap-2.5" role="group" aria-label={t.settings.accent.title}>
      {CURATED_ACCENTS.map((option) => {
        const active = mounted && accent === option.id
        const label = t.settings.accent.options[option.id].label
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => persistAccent(option.id)}
            aria-label={label}
            title={label}
            aria-pressed={active}
            style={{ backgroundColor: option[mode].acc, boxShadow: active ? RING.selected : RING.idle }}
            className="hit-44 size-[30px] shrink-0 rounded-full transition-transform active:scale-90"
          />
        )
      })}
    </div>
  )
}
