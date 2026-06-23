'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export function ThemeSegmented() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const s = t.settings.appearance

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const current = mounted ? theme : undefined

  return (
    <div>
      <h2 className="text-sm font-bold text-foreground">{s.themeLabel}</h2>
      <div className="mt-3 inline-flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-1">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
            current === 'light' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
          )}
        >
          <Sun size={13} />
          {s.light}
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
            current === 'dark' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
          )}
        >
          <Moon size={13} />
          {s.dark}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{s.auroraNote}</p>
    </div>
  )
}
