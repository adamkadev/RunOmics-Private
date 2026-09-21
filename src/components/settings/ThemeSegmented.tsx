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

  return (
    <div>
      <h2 className="text-sm font-bold text-foreground">{s.themeLabel}</h2>
      <div className="mt-3 flex w-full gap-1 rounded-full bg-foreground/[0.04] p-1">
        {OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={cn(
              'flex-1 min-h-[44px] rounded-full py-1.5 text-xs font-semibold transition-colors',
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
