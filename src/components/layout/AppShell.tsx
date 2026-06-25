'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { PageTransition } from './PageTransition'
import { ThemeSync } from './ThemeSync'
import { Aurora } from './Aurora'
import { hasGlobalTopBar, getPageAuroraKey } from '@/lib/navigation'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showTopBar = hasGlobalTopBar(pathname)

  return (
    <div className="min-h-screen" data-page-aurora={getPageAuroraKey(pathname)}>
      <Aurora />
      <ThemeSync />
      <Sidebar />
      <main className="min-h-screen lg:ml-[248px]">
        {/* Mobile spacer: top bar height + notch safe area - skipped on Profile/
            Settings, which manage their own safe-area top padding */}
        {showTopBar && (
          <div
            className="lg:hidden"
            style={{ height: 'calc(3.5rem + max(env(safe-area-inset-top), 12px))' }}
          />
        )}
        <div className="mx-auto max-w-5xl px-4 pt-4 pb-6 sm:px-6 lg:pt-8 lg:pb-8">
          <PageTransition>{children}</PageTransition>
        </div>
        {/* Mobile spacer: floating glass tab bar + home indicator safe area */}
        <div
          className="lg:hidden"
          style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
        />
      </main>

    </div>
  )
}
