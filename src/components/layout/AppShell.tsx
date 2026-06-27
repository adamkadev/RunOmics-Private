'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { PageTransition } from './PageTransition'
import { ThemeSync } from './ThemeSync'
import { Aurora } from './Aurora'
import { getPageAuroraKey, hasGlobalTopBar } from '@/lib/navigation'
import { cn } from '@/lib/utils'

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
  const showTopBar = hasGlobalTopBar(pathname)
  const isPopNavigation = useRef(false)

  // Browser/router back-forward (popstate) restores scroll position instead
  // of resetting to top, so returning from a detail page lands where you left.
  useLayoutEffect(() => {
    const onPopState = () => {
      isPopNavigation.current = true
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useLayoutEffect(() => {
    const positions = getScrollPositions()
    window.scrollTo(0, isPopNavigation.current ? positions[pathname] ?? 0 : 0)
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
      <Sidebar />
      <main className="min-h-screen lg:ml-[248px]">
        {/* Mobile top padding: breathing room below the Dashboard's top bar,
            or - on every other page, which has no top bar - the notch safe area instead. */}
        <div
          className={cn(
            'mx-auto max-w-5xl px-4 pb-28 sm:px-6 lg:pb-8 lg:pt-8',
            showTopBar ? 'pt-4' : 'pt-[max(env(safe-area-inset-top),12px)]'
          )}
        >
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

    </div>
  )
}
