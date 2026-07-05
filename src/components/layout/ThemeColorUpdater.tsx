'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useAccent } from '@/lib/useAccent'

const DEFAULT_BG: [string, string] = ['#eef3f0', '#070f0c']

const bgColors: Record<string, [string, string]> = {
  nature: DEFAULT_BG,
  performance: ['#eff6ff', '#06091a'],
  impact: ['#fff1f2', '#130608'],
  motivation: ['#fff7ed', '#130a04'],
  endurance: ['#f5f3ff', '#0d0a1a'],
}

export function ThemeColorUpdater() {
  const { systemTheme, theme } = useTheme()
  const accent = useAccent()

  useEffect(() => {
    const isDark = theme === 'dark' || (theme === 'system' && systemTheme === 'dark')
    const colors = bgColors[accent] ?? DEFAULT_BG
    const color = isDark ? colors[1] : colors[0]

    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute('content', color)
    })
  }, [theme, systemTheme, accent])

  return null
}
