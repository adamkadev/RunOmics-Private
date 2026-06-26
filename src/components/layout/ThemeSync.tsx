'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT, isAccentId } from '@/lib/accent'

// Next.js's static viewport.themeColor (if configured with a `media` array) injects one
// <meta name="theme-color"> per query - browsers honor whichever matches and silently
// ignore any other tag, so a single dynamically-updated meta must be the only one left.
function applyMetaThemeColor(color: string) {
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  let primary: HTMLMetaElement | null = null
  metas.forEach((meta) => {
    if (!primary) { primary = meta; return }
    meta.remove()
  })
  if (!primary) {
    primary = document.createElement('meta')
    primary.name = 'theme-color'
    document.head.appendChild(primary)
  }
  primary.removeAttribute('media')
  primary.content = color
}

export function ThemeSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    function sync() {
      const style = getComputedStyle(document.documentElement)
      const bg = style.getPropertyValue('--background').trim()

      document.documentElement.style.backgroundColor = bg
      document.body.style.backgroundColor = bg
      applyMetaThemeColor(bg)
    }

    sync()

    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'class'] })

    // Other tabs only update localStorage - mirror the change onto this tab's <html>
    // so CSS (`[data-accent]` selectors) and the MutationObserver above stay in sync.
    function onStorage(e: StorageEvent) {
      if (e.key !== ACCENT_STORAGE_KEY) return
      document.documentElement.setAttribute('data-accent', isAccentId(e.newValue) ? e.newValue : DEFAULT_ACCENT)
    }
    window.addEventListener('storage', onStorage)

    return () => {
      observer.disconnect()
      window.removeEventListener('storage', onStorage)
    }
  }, [resolvedTheme])

  return null
}
