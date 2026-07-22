'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useAccent } from '@/lib/useAccent'
import { applyThemeColor } from '@/lib/accent'

export function ThemeColorUpdater() {
  const { systemTheme, theme } = useTheme()
  const accent = useAccent()

  useEffect(() => {
    applyThemeColor(accent, theme === 'dark' || (theme === 'system' && systemTheme === 'dark'))
  }, [theme, systemTheme, accent])

  return null
}
