'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { PageTransition } from './PageTransition'
import { ThemeSync } from './ThemeSync'
import { Aurora } from './Aurora'
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
        {/* Mobile spacer: top bar height + notch safe area - skipped on Profile/
            Settings, which manage their own safe-area top padding */}
        <div className="mx-auto max-w-5xl px-4 pt-4 pb-28 sm:px-6 lg:pt-8 lg:pb-8">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

    </div>
  )
}
