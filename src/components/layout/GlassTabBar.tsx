'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Activity, CalendarDays, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'

const TABS = [
  { href: '/', label: t.nav.items.dashboard, icon: LayoutDashboard },
  { href: '/activities', label: t.nav.items.activities, icon: Activity },
  { href: '/calendar', label: t.nav.items.calendar, icon: CalendarDays },
  { href: '/profile', label: t.nav.items.profile, icon: User },
] as const

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

const tabClass = 'flex flex-1 flex-col items-center gap-1 py-1 transition-colors active:scale-95'

/**
 * Persistent floating glass tab bar (mobile only): the four primary
 * destinations, no overflow menu. Everything else (Analytics, Goals,
 * Records, Shoes, Heatmap, Settings) is reached contextually from
 * Dashboard or Profile instead of a nav entry.
 */
export function GlassTabBar() {
  const pathname = usePathname()

  return (
    <div
      className="fixed inset-x-0 bottom-3 z-30 px-3 lg:hidden"
    >
      <GlassSurface
        as="nav"
        variant="nav"
        className="flex items-center justify-between rounded-full px-3.5 py-3"
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(tabClass, active ? 'text-accent-text' : 'text-muted-foreground')}
            >
              <Icon size={20} strokeWidth={2} />
              <span className={cn('text-micro', active ? 'font-semibold' : 'font-medium')}>{label}</span>
            </Link>
          )
        })}
      </GlassSurface>
    </div>
  )
}