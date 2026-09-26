'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { ACCENT_STORAGE_KEY, parseAccent } from '@/lib/accent'

export function ThemeSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    function sync() {
      const style = getComputedStyle(document.documentElement)
      const bg = style.getPropertyValue('--background').trim()

      document.documentElement.style.backgroundColor = bg
      document.body.style.backgroundColor = bg
      // theme-color is left alone: it is fixed in the layout (see
      // STATUS_BAR_COLOR), because iOS keeps whatever it held at install.
    }

    sync()

    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent', 'class'] })

    function onStorage(e: StorageEvent) {
      if (e.key !== ACCENT_STORAGE_KEY) return
      // Another tab changed the accent.
      document.documentElement.setAttribute('data-accent', parseAccent(e.newValue))
    }
    window.addEventListener('storage', onStorage)

    return () => {
      observer.disconnect()
      window.removeEventListener('storage', onStorage)
    }
  }, [resolvedTheme])

  return null
}
