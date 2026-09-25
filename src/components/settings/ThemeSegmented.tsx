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

export function ThemeSegmented() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const s = t.settings.appearance

  const current = mounted ? theme : undefined

  // Inline, as in R7f: the label and a compact control on one row.
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-body font-semibold text-foreground">{s.themeLabel}</h3>
      <div className="flex gap-1 rounded-full bg-foreground/[0.04] p-1" role="group" aria-label={s.themeLabel}>
        {OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={current === value}
            className={cn(
              'min-h-[44px] rounded-full px-3.5 text-xs font-semibold transition-colors',
              current === value ? 'bg-accent text-accent-foreground' : 'text-foreground/55'
            )}
          >
            {label()}
          </button>
        ))}
      </div>
    </div>
  )
}
