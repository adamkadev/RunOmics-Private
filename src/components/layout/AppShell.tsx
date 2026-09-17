'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { PageTransition } from './PageTransition'
import { ThemeSync } from './ThemeSync'
import { Aurora } from './Aurora'
import { NavigationHistoryProvider } from './NavigationHistory'
import { getPageAuroraKey } from '@/lib/navigation'

const SCROLL_POSITIONS_KEY = 'scrollPositions'

function getScrollPositions(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_POSITIONS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPopNavigation = useRef(false)

  useLayoutEffect(() => {
    const onPopState = () => {
      isPopNavigation.current = true
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useLayoutEffect(() => {
    const positions = getScrollPositions()
    const top = isPopNavigation.current ? positions[pathname] ?? 0 : 0
    window.scrollTo({ top, left: 0, behavior: 'instant' })
    isPopNavigation.current = false
  }, [pathname])

  useLayoutEffect(() => {
    const saveScroll = () => {
      const positions = getScrollPositions()
      positions[pathname] = window.scrollY
      sessionStorage.setItem(SCROLL_POSITIONS_KEY, JSON.stringify(positions))
    }
    window.addEventListener('scroll', saveScroll, { passive: true })
    return () => {
      saveScroll()
      window.removeEventListener('scroll', saveScroll)
    }
  }, [pathname])

  return (
    <NavigationHistoryProvider>
      <div className="min-h-screen" data-page-aurora={getPageAuroraKey(pathname)}>
        <Aurora />
        <ThemeSync />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-20 lg:hidden"
          style={{
            height: 'var(--top-scrim)',
            background: 'linear-gradient(to bottom, var(--background) 30%, transparent)',
          }}
        />
        <Sidebar />
        <main className="min-h-screen lg:ml-[248px]">
          {/* pb-28 alone is the nav's own height with room to spare on a
              home-button phone, but it's a fixed 112px - on a notched device
              --safe-bottom eats into that margin instead of adding to it, so
              a page whose last section lands right at the edge (e.g. Plan's
              race cards) can still finish behind the nav. Add the inset
              rather than assume the flat value already covers it. */}
          <div className="mx-auto max-w-5xl px-4 pb-[calc(7rem+var(--safe-bottom))] pt-[var(--top-scrim)] sm:px-6 lg:pb-8 lg:pt-8">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
    </NavigationHistoryProvider>
  )
}
