'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { PageTransition } from './PageTransition'
import { ThemeSync } from './ThemeSync'
import { NavigationHistoryProvider } from './NavigationHistory'
import { CompactTitleBar } from './CompactTitleBar'

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

  // Every scroll event used to parse and rewrite sessionStorage. It only has
  // to be written when the page is left - a route change or the tab going
  // away - so a scroll just notes the offset. Noting it, rather than reading
  // scrollY on the way out, also keeps the value the page had: by the time a
  // route change's cleanup runs, the next page is mounted and a shorter one
  // has already clamped the offset.
  const lastScrollY = useRef(0)
  useLayoutEffect(() => {
    lastScrollY.current = window.scrollY
    const note = () => {
      lastScrollY.current = window.scrollY
    }
    const persist = () => {
      const positions = getScrollPositions()
      positions[pathname] = lastScrollY.current
      try {
        sessionStorage.setItem(SCROLL_POSITIONS_KEY, JSON.stringify(positions))
      } catch {
      }
    }
    window.addEventListener('scroll', note, { passive: true })
    window.addEventListener('pagehide', persist)
    return () => {
      persist()
      window.removeEventListener('scroll', note)
      window.removeEventListener('pagehide', persist)
    }
  }, [pathname])

  return (
    <NavigationHistoryProvider>
      <div className="min-h-screen">
        <ThemeSync />
        {/* The one fixed element that touches the top edge (v4.8): iOS 26
            takes the topmost fixed element at the top as the page's bar and
            blurs what sits under it, and it keeps the zone of the tallest one
            it has seen. The compact title bar (safe area + 44 pt) and the
            fullscreen maps used to touch the edge too and left that zone
            over the large title. So this strip is always mounted, always
            opaque, exactly the status bar's height, and everything else that
            is fixed starts under it. */}
        <div
          aria-hidden
          data-testid="status-strip"
          className="pointer-events-none fixed inset-x-0 top-0 z-[10000] lg:hidden"
          style={{ height: 'var(--safe-top)', background: 'var(--status-bar)' }}
        />
        <Sidebar />
        {/* Positioned, with no z-index: not a stacking context, which would
            trap the maps' fullscreen overlays (z-50) under other layers. */}
        <main className="relative min-h-screen lg:ml-[248px]">
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
        {/* After <main>, so it paints over the content scrolled under it. */}
        <CompactTitleBar />
      </div>
    </NavigationHistoryProvider>
  )
}
