'use client'

import { useTheme } from 'next-themes'
import { t } from '@/i18n'
import { CURATED_ACCENTS, persistAccent } from '@/lib/accent'
import { useAccent } from '@/lib/useAccent'
import { useMounted } from '@/lib/useMounted'

/**
 * The accent: a 2 pt gap of card, then a 2 pt ring in text ink (3.0 1i).
 * The others: a 1 pt hairline inside the swatch, so Mono's white still has
 * an edge on a light card.
 */
const RING = {
  selected: '0 0 0 2px var(--card), 0 0 0 4px var(--foreground)',
  idle: 'inset 0 0 0 1px var(--line-2)',
}

/**
 * Settings → Appearance → Accent (v4.3; 3.0 1i): five fixed palettes as
 * 30 pt swatches, each in the mode it will be seen in. No blue, orange,
 * red or amber - those are the zone and status colours - and no custom
 * hue, which could land on them. Each swatch keeps a 44 pt target; on a
 * phone the row spreads to 44 pt apart so the targets never overlap.
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
