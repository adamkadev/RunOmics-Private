'use client'

import { useTheme } from 'next-themes'
import { useMounted } from '@/lib/useMounted'
import { cn } from '@/lib/utils'
import { SEGMENTED_IDLE_CLASS, SEGMENTED_THUMB_CLASS, SEGMENTED_TRACK_CLASS } from '@/components/ui/SegmentedTabs'
import { t } from '@/i18n'

const OPTIONS = [
  { value: 'light',  label: () => t.settings.appearance.light  },
  { value: 'system', label: () => t.settings.appearance.auto   },
  { value: 'dark',   label: () => t.settings.appearance.dark   },
] as const

/** A choice, not a tablist (there is no panel), so the buttons are pressed or not. */
export function ThemeSegmented() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const current = mounted ? theme : undefined

  return (
    <div
      className={SEGMENTED_TRACK_CLASS}
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
            'hit-44 h-[26px] px-3 text-[13px] transition-colors',
            current === value ? SEGMENTED_THUMB_CLASS : SEGMENTED_IDLE_CLASS
          )}
        >
          {label()}
        </button>
      ))}
    </div>
  )
}
