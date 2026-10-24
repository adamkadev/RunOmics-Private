'use client'

import { useEffect } from 'react'
import { AWAY_BEFORE_CHECK_MS, editing, shouldReload } from '@/lib/appUpdate'
import { BUILD_COMMIT } from '@/lib/version'

export function UpdateOnResume() {
  useEffect(() => {
    let hiddenAt: number | null = document.visibilityState === 'hidden' ? Date.now() : null
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      const awayMs = hiddenAt === null ? 0 : Date.now() - hiddenAt
      hiddenAt = null
      if (awayMs < AWAY_BEFORE_CHECK_MS || BUILD_COMMIT === 'local') return
      fetch('/api/version', { cache: 'no-store' })
        .then((res) => (res.ok ? (res.json() as Promise<{ build?: unknown }>) : null))
        .then((body) => {
          const liveBuild = typeof body?.build === 'string' ? body.build : null
          if (shouldReload({ awayMs, ownBuild: BUILD_COMMIT, liveBuild, editing: editing(document) })) window.location.reload()
        })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
  return null
}
