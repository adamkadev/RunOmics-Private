'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import {
  ACCENT_CSS_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  CUSTOM_ACCENT_STYLE_ID,
  DEFAULT_ACCENT,
  parseAccent,
  resolveAccent,
} from '@/lib/accent'

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

    function onStorage(e: StorageEvent) {
      if (e.key !== ACCENT_STORAGE_KEY) return
      // Another tab changed the accent. Its generated CSS travels in its own
      // key, so read that rather than recomputing the hue here.
      const resolved = resolveAccent(parseAccent(e.newValue))
      const css = resolved.isCustom ? localStorage.getItem(ACCENT_CSS_STORAGE_KEY) : null
      const existing = document.getElementById(CUSTOM_ACCENT_STYLE_ID)
      if (css) {
        const style = existing ?? document.createElement('style')
        style.id = CUSTOM_ACCENT_STYLE_ID
        style.textContent = css
        if (!existing) document.head.appendChild(style)
      } else {
        existing?.remove()
      }
      document.documentElement.setAttribute('data-accent', css || !resolved.isCustom ? resolved.attribute : DEFAULT_ACCENT)
    }
    window.addEventListener('storage', onStorage)

    return () => {
      observer.disconnect()
      window.removeEventListener('storage', onStorage)
    }
  }, [resolvedTheme])

  return null
}
