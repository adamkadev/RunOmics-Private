'use client'

import { useTheme } from 'next-themes'
import { useMounted } from '@/lib/useMounted'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

const OPTIONS = [
  { value: 'light',  label: () => t.settings.appearance.light  },
  { value: 'system', label: () => t.settings.appearance.auto   },
  { value: 'dark',   label: () => t.settings.appearance.dark   },
] as const

/**
 * Light / Auto / Dark as the quiet tabs (v4.17): the inset track with its
 * line, the choice lifted onto the card surface in text ink. A choice, not
 * a tablist - there is no panel - so the buttons are pressed or not. The
 * row around it carries the label.
 */
export function ThemeSegmented() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const current = mounted ? theme : undefined

  return (
    <div
      className="flex shrink-0 gap-0.5 rounded-[11px] border border-border bg-[var(--segmented-track)] p-[3px]"
      role="group"
      aria-label={t.settings.appearance.themeLabel}
    >
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={current === value}
          className={cn(
            'hit-44 h-[30px] rounded-lg px-3.5 text-[13px] transition-colors',
            current === value
              ? 'bg-[var(--segmented-pill)] font-semibold text-foreground shadow-[var(--segmented-pill-shadow)]'
              : 'font-medium text-muted-foreground hover:text-foreground'
          )}
        >
          {label()}
        </button>
      ))}
    </div>
  )
}
