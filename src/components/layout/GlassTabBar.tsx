'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Activity, CalendarDays, BarChart2, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { activeNavHref } from '@/lib/navigation'
import { t } from '@/i18n'
import { useHaptic } from '@/lib/useHaptic'
import { useFullscreenChromeHidden } from './FullscreenChromeContext'

// Five tabs, in the mockup's order. Plan is a top-level destination again:
// Today keeps the read-only week glance, Plan owns the editable calendar.
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
        style={{ paddingBottom: 'max(4px, calc(var(--safe-bottom) * 0.6))' }}
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
              'flex flex-1 flex-col items-center gap-0.5 pt-2.5 pb-1.5 transition-colors active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-xl',
              active ? 'text-accent-text' : 'text-muted-foreground'
            )}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.75} />
            <span className={cn('text-micro', active ? 'font-semibold' : 'font-medium')}>
              {label}
            </span>
          </Link>
        )
      })}
      </div>
    </nav>
  )
}
