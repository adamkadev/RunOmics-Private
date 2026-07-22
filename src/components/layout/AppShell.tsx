'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { PageTransition } from './PageTransition'
import { ThemeSync } from './ThemeSync'
import { Aurora } from './Aurora'
import { getPageAuroraKey, isPullToRefreshPage } from '@/lib/navigation'
import { usePullToRefresh, PULL_THRESHOLD_PX } from '@/lib/usePullToRefresh'
import { t } from '@/i18n'

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
  const router = useRouter()
  const isPopNavigation = useRef(false)
  const { containerRef, pullPx, refreshing } = usePullToRefresh(() => router.refresh(), isPullToRefreshPage(pathname))

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
    <div className="min-h-screen" data-page-aurora={getPageAuroraKey(pathname)}>
      <Aurora />
      <ThemeSync />
      {/* Scrim under the iOS status bar: scrolling content used to run straight
          under the clock and battery. A plain fade out of `--background` rather
          than a blur - it already follows the theme, and costs no compositing.
          Mobile only; the desktop layout has no status bar over it. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-20 lg:hidden"
        style={{
          height: 'calc(var(--safe-top) + 28px)',
          background: 'linear-gradient(to bottom, var(--background) 30%, transparent)',
        }}
      />
      <Sidebar />
      <main ref={containerRef} className="min-h-screen lg:ml-[248px]">
        <div
          className="flex justify-center overflow-hidden transition-[height] duration-200 lg:hidden"
          style={{ height: refreshing ? 40 : pullPx }}
        >
          <div className="flex items-center gap-2 pt-2 text-xs font-semibold text-accent-text">
            <RefreshCw
              size={16}
              className={refreshing ? 'animate-spin' : undefined}
              style={refreshing ? undefined : { transform: `rotate(${(pullPx / PULL_THRESHOLD_PX) * 360}deg)` }}
            />
            {refreshing && <span>{t.common.refreshing}</span>}
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-28 pt-[max(env(safe-area-inset-top),20px)] sm:px-6 lg:pb-8 lg:pt-8">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

    </div>
  )
}
