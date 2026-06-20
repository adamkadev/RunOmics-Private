'use client'

import { useEffect } from 'react'
import { accentIconSrc } from '@/lib/accent'
import { useAccent } from '@/lib/useAccent'

export function FaviconSync() {
  const accent = useAccent()

  useEffect(() => {
    const link192 = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="192x192"]')
    const link512 = document.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="512x512"]')
    if (link192) link192.href = accentIconSrc(accent, 192)
    if (link512) link512.href = accentIconSrc(accent, 512)
  }, [accent])

  return null
}
