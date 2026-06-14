'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

const COLORS = {
  light: { background: '#f8fafc', card: '#ffffff' },
  dark:  { background: '#030712', card: '#111827' },
}

export function ThemeSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const { background, card } = resolvedTheme === 'dark' ? COLORS.dark : COLORS.light

    // Force iOS to repaint safe area with correct background color
    document.documentElement.style.backgroundColor = background
    document.body.style.backgroundColor = background

    // Update status bar color for PWA / Safari minimal-UI
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.content = card
  }, [resolvedTheme])

  return null
}
