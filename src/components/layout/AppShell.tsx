'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { PageTransition } from './PageTransition'
import { ThemeSync } from './ThemeSync'
import { Aurora } from './Aurora'
import { getPageAuroraKey } from '@/lib/navigation'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-screen" data-page-aurora={getPageAuroraKey(pathname)}>
      <Aurora />
      <ThemeSync />
      <Sidebar />
      <main className="min-h-screen lg:ml-[248px]">
        {/* Mobile spacer: top bar height + notch safe area - skipped on Profile/
            Settings, which manage their own safe-area top padding */}
        <div className="mx-auto max-w-5xl px-4 pt-4 pb-6 sm:px-6 lg:pt-8 lg:pb-8">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

    </div>
  )
}
