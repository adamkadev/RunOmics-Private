'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Activity, CalendarDays, BarChart2, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { activeNavHref } from '@/lib/navigation'
import { t } from '@/i18n'
import { useHaptic } from '@/lib/useHaptic'
import { useFullscreenChromeHidden } from './FullscreenChromeContext'

const TABS = [
  { href: '/',           label: t.nav.items.dashboard,   icon: LayoutDashboard },
  { href: '/activities', label: t.nav.items.activities,  icon: Activity },
  { href: '/plan',       label: t.nav.items.plan,        icon: CalendarDays },
  { href: '/analytics',  label: t.nav.items.analytics,   icon: BarChart2 },
  { href: '/profile',    label: t.nav.items.profile,     icon: User },
] as const

const TAB_HREFS = TABS.map((tab) => tab.href)

export function GlassTabBar() {
  const pathname = usePathname()
  const currentHref = activeNavHref(pathname, TAB_HREFS)
  const hidden = useFullscreenChromeHidden()
  const haptic = useHaptic()

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div
        className={cn(
          'glass-nav flex items-center border-x-0 border-b-0 transition-transform duration-200 ease-out',
          hidden ? 'translate-y-full' : 'translate-y-0 pointer-events-auto'
        )}
        // Clear of the home indicator's swipe zone (at 60 % of the inset the
        // labels sat in it), but not the full 34 pt, which floated the bar.
        style={{ paddingBottom: 'var(--tab-bar-bottom)' }}
      >
        {TABS.map(({ href, label, icon: Icon }) => {
        const active = currentHref === href
        return (
          <Link
            key={href}
            href={href}
            onClick={() => { if (!active) haptic('light') }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-12 flex-1 items-center justify-center pt-1.5 transition-colors duration-150 active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-xl',
              active ? 'text-accent' : 'text-muted-foreground'
            )}
          >
            {/* No pill (v4.3.2): the active tab is its icon and label in the
                accent, both outline icons in either state. */}
            <span data-testid={active ? 'tab-active' : undefined} className="flex flex-col items-center gap-0.5 px-3 py-1">
              <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
              <span className={cn('text-caption', active ? 'font-semibold' : 'font-medium')}>
                {label}
              </span>
            </span>
          </Link>
        )
      })}
      </div>
    </nav>
  )
}
