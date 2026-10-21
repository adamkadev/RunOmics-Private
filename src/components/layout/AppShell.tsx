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

  // The private site's sign-in (src/proxy.ts) is a page on its own: no tab
  // bar or sidebar pointing at pages it cannot open yet.
  if (pathname === SIGN_IN_PATH) {
    return (
      <div className="min-h-screen">
        <ThemeSync />
        <main>{children}</main>
      </div>
    )
  }

  return (
    <NavigationHistoryProvider>
      <div className="min-h-screen">
        <ThemeSync />
        {/* The top soft scroll edge (Liquid Glass v3, G5): a fixed wrapper
            with no background, its four absolute layers three blurs that
            grow stronger toward the top and a tint - no hairline - shown
            while the compact bar is (globals.css, .scroll-edge). */}
        <div aria-hidden data-testid="scroll-edge" className="scroll-edge lg:hidden"><i /><i /><i /><i /></div>
        {/* The edge sampler: solid, full width, over 10 px tall, at the top
            edge, never resized or hidden. WebKit samples 4 px in for such a
            bar, and finding one, iOS 26 draws no blur of its own over the
            large titles. Taps stay on, so its hit test can't skip it. */}
        <div
          data-testid="edge-sampler"
          className="edge-sampler lg:hidden"
          // Under the status bar: a tap scrolls to the top, as the status bar does natively.
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />
        <Sidebar />
        {/* Positioned, with no z-index: not a stacking context, which would
            trap the maps' fullscreen overlays (z-50) under the top scrim. */}
        {/* Padded by the side insets (F15): in landscape the content clears
            the notch and the corners, while the aura, which bleeds past the
            content, still runs to the screen's edge. */}
        <main className="relative min-h-screen overflow-x-clip pl-[var(--safe-left)] pr-[var(--safe-right)] lg:ml-[248px]">
          {/* pb-28 alone is the nav's own height with room to spare on a
              home-button phone, but it's a fixed 112px - on a notched device
              --safe-bottom eats into that margin instead of adding to it, so
              a page whose last section lands right at the edge (e.g. Plan's
              race cards) can still finish behind the nav. Add the inset
              rather than assume the flat value already covers it. */}
          {/* Content up to 1120 pt wide, centred, 36 pt from the top and 32 at
              the sides on desktop (v4.17). */}
          {/* Relative, with no z-index, so the content paints over the aura
              (positioned, before it) without becoming a stacking context. */}
          <div className="relative mx-auto max-w-5xl px-4 pb-[calc(7rem+var(--safe-bottom))] pt-[var(--top-scrim)] sm:px-6 lg:max-w-[1184px] lg:px-8 lg:pb-16 lg:pt-9">
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
