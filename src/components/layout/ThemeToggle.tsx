'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useMounted } from '@/lib/useMounted'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

/**
 * Light or dark, whichever is not on screen. `compact` is the sidebar's 30 px
 * square on the inset surface (v4.17); its hit area still reaches 44 px.
 */
export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const size = compact ? 'h-[30px] w-[30px]' : 'h-11 w-11'

  if (!mounted) {
    return <div className={cn(size, 'rounded-lg', className)} />
  }

  const dark = resolvedTheme === 'dark'
  return (
    <button
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={cn(
        'flex items-center justify-center transition-all duration-150 active:scale-90',
        compact
          ? 'hit-44 rounded-lg border border-border bg-[var(--surface-2)] text-[var(--text-2)] hover:text-foreground'
          : 'rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
        size,
        className
      )}
      aria-label={t.theme.toggle}
    >
      {dark ? <Sun size={compact ? 14 : 16} /> : <Moon size={compact ? 14 : 16} />}
    </button>
  )
}
