'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

const CARD_COLORS = { light: '#ffffff', dark: '#111827' }

export function ThemeSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (!resolvedTheme) return
    const color = resolvedTheme === 'dark' ? CARD_COLORS.dark : CARD_COLORS.light

    // Replace all theme-color metas (including the media-query ones from layout.tsx)
    // with a single authoritative one matching the user's chosen theme.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove())
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = color
    document.head.appendChild(meta)
  }, [resolvedTheme])

  return null
}
