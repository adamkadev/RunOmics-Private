'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { PageTransition } from './PageTransition'
import { ThemeSync } from './ThemeSync'
import { NavigationHistoryProvider } from './NavigationHistory'
import { CompactTitleBar } from './CompactTitleBar'
import { Aura } from './Aura'
import { SIGN_IN_PATH } from '@/lib/siteSession'
import { isPopNavigation, notePopNavigation, popNavigationHandled } from '@/lib/popNavigation'

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

  useLayoutEffect(() => {
    window.addEventListener('popstate', notePopNavigation)
    return () => window.removeEventListener('popstate', notePopNavigation)
  }, [])

  useLayoutEffect(() => {
    const positions = getScrollPositions()
    const top = isPopNavigation() ? positions[pathname] ?? 0 : 0
    window.scrollTo({ top, left: 0, behavior: 'instant' })
    popNavigationHandled()
  }, [pathname])

  // A scroll only notes the offset, written when the page is left: by the time a route change's cleanup
  // runs, the next page is mounted and a shorter one has already clamped scrollY.
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

  // The sign-in is a page on its own: no tab bar or sidebar pointing at pages it cannot open yet.
  if (pathname === SIGN_IN_PATH) {
    return (
      <div className="min-h-screen">
        <ThemeSync />
        <main className="relative min-h-screen overflow-x-clip">
          <Aura />
          <div className="relative">{children}</div>
        </main>
      </div>
    )
  }

  return (
    <NavigationHistoryProvider>
      <div className="min-h-screen">
        <ThemeSync />
        {/* Four layers: three blurs growing stronger toward the top, and a tint (globals.css, .scroll-edge). */}
        <div aria-hidden data-testid="scroll-edge" className="scroll-edge lg:hidden"><i /><i /><i /><i /></div>
        {/* Solid, full width, over 10 px tall, at the top edge, never resized or hidden: WebKit samples
            4 px in for such a bar, and finding one, iOS 26 draws no blur of its own over the large titles.
            Taps stay on, so its hit test can't skip it. */}
        <div
          data-testid="edge-sampler"
          className="edge-sampler lg:hidden"
          // Under the status bar: a tap scrolls to the top, as the status bar does natively.
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />
        <Sidebar />
        {/* Positioned, with no z-index: not a stacking context, which would
            trap the maps' fullscreen overlays (z-50) under the top scrim. */}
        <main className="relative min-h-screen overflow-x-clip lg:ml-[248px]">
          {/* The bottom padding clears the tab bar (its float, its height, 24 pt of air, the home indicator)
              from the bar's own tokens. Relative, with no z-index, so the content paints over the aura
              without becoming a stacking context. */}
          <div className="relative mx-auto max-w-5xl px-4 pb-[calc(var(--tab-bar-float)+var(--tab-bar-h)+24px+var(--safe-bottom))] pt-[var(--top-scrim)] sm:px-6 lg:max-w-[1184px] lg:px-8 lg:pb-16 lg:pt-9">
            <Aura />
            <div className="relative">
              <PageTransition>{children}</PageTransition>
            </div>
          </div>
        </main>
        {/* After <main>, so it paints over the content scrolled under it. */}
        <CompactTitleBar />
      </div>
    </NavigationHistoryProvider>
  )
}
