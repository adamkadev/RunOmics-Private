'use client'

import { useTheme } from 'next-themes'
import { t } from '@/i18n'
import { CURATED_ACCENTS, persistAccent } from '@/lib/accent'
import { useAccent } from '@/lib/useAccent'
import { useMounted } from '@/lib/useMounted'

/**
 * A 2 pt ring of card between the swatch and its outline: text ink when it
 * is the accent (v4.17), a line-2 hairline when it is not.
 */
const RING = {
  selected: 'inset 0 0 0 2px var(--card), 0 0 0 2px var(--foreground)',
  idle: 'inset 0 0 0 2px var(--card), 0 0 0 1px var(--line-2)',
}

/**
 * Settings → Appearance → Accent (v4.3; v4.17): five fixed palettes as
 * 28 pt swatches, each in the mode it will be seen in. No blue, orange,
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
            className="hit-44 size-7 shrink-0 rounded-full transition-transform active:scale-90"
          />
        )
      })}
    </div>
  )
}
