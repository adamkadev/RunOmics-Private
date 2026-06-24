'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useAccent } from '@/lib/useAccent'

export function ThemeSync() {
  const { resolvedTheme } = useTheme()
  const accent = useAccent()

  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const bg = style.getPropertyValue('--background').trim()

    document.documentElement.style.backgroundColor = bg
    document.body.style.backgroundColor = bg

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.content = bg
  }, [resolvedTheme, accent])

  return null
}
