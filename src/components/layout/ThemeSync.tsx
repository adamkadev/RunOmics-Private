'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { ACCENT_STORAGE_KEY, DEFAULT_ACCENT, isAccentId, type AccentId } from '@/lib/accent'

function readAccent(): AccentId {
  const stored = localStorage.getItem(ACCENT_STORAGE_KEY)
  return isAccentId(stored) ? stored : DEFAULT_ACCENT
}

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

function applyAccentIcons(accent: AccentId) {
  const suffix = accent === DEFAULT_ACCENT ? '' : `-${accent}`

  const apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (apple) apple.href = `/icons/apple-touch-icon-180${suffix}.png`

  let favicon192 = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="192x192"]')
  if (!favicon192) {
    favicon192 = document.createElement('link')
    favicon192.rel = 'icon'
    favicon192.type = 'image/png'
    favicon192.setAttribute('sizes', '192x192')
    document.head.appendChild(favicon192)
  }
  favicon192.href = `/icons/icon-192${suffix}.png`
}

export function ThemeSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    function sync() {
      const accent = readAccent()
      const style = getComputedStyle(document.documentElement)
      const bg = style.getPropertyValue('--background').trim()

      document.documentElement.style.backgroundColor = bg
      document.body.style.backgroundColor = bg
      applyMetaThemeColor(bg)
      applyAccentIcons(accent)
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
