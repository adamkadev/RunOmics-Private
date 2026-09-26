'use client'

import { useTheme } from 'next-themes'
import { t } from '@/i18n'
import { CURATED_ACCENTS, persistAccent } from '@/lib/accent'
import { useAccent } from '@/lib/useAccent'
import { useMounted } from '@/lib/useMounted'

/** A ring with a gap of card between it and the swatch. */
const SELECTED_RING = '0 0 0 2px var(--card), 0 0 0 4px var(--foreground)'

/**
 * Settings → Appearance → Accent (v4.3): five fixed palettes, each swatch in
 * the mode it will be seen in. No blue, orange, red or amber - those are the
 * zone and caution colours - and no custom hue, which could land on them.
 */
export function AccentPicker() {
  const accent = useAccent()
  const mounted = useMounted()
  const { resolvedTheme } = useTheme()
  const mode = mounted && resolvedTheme === 'light' ? 'light' : 'dark'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-body font-semibold text-foreground">{t.settings.accent.title}</h3>
        <span className="min-h-4 text-footnote text-muted-foreground">
          {mounted ? t.settings.accent.options[accent].label : ''}
        </span>
      </div>

      <div className="mt-3 flex flex-nowrap items-center justify-between gap-1.5">
        {CURATED_ACCENTS.map((option) => {
          const active = mounted && accent === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => persistAccent(option.id)}
              aria-label={t.settings.accent.options[option.id].label}
              aria-pressed={active}
              style={{ backgroundColor: option[mode].acc, boxShadow: active ? SELECTED_RING : 'none' }}
              className="h-11 w-11 shrink-0 rounded-full transition-transform active:scale-90 sm:h-12 sm:w-12"
            />
          )
        })}
      </div>
    </div>
  )
}
