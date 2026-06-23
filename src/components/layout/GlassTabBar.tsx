'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Activity, CalendarDays, BarChart2, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'

const TABS = [
  { href: '/', label: t.nav.items.dashboard, icon: LayoutDashboard },
  { href: '/activities', label: t.nav.items.activities, icon: Activity },
  { href: '/calendar', label: t.nav.items.calendar, icon: CalendarDays },
  { href: '/analytics', label: t.nav.items.analytics, icon: BarChart2 },
] as const

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

const tabClass = 'flex flex-1 flex-col items-center gap-1 py-1 transition-colors active:scale-95'

/**
 * Persistent floating glass tab bar (mobile only). Replaces the burger-only
 * navigation: the four primary destinations are one tap away, and "More"
 * opens the full drawer for the remaining routes (goals, records, etc.).
 */
export function GlassTabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const pathname = usePathname()
  const moreActive = moreOpen || !TABS.some((tab) => isActive(pathname, tab.href))

  return (
    <div
      className="fixed inset-x-0 bottom-3 z-30 px-3 lg:hidden"
      style={{ marginBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
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
              <Icon size={21} strokeWidth={2} />
              <span className={cn('text-[9px]', active ? 'font-semibold' : 'font-medium')}>{label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={onMore}
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          className={cn(tabClass, moreActive ? 'text-accent-text' : 'text-muted-foreground')}
        >
          <MoreHorizontal size={21} strokeWidth={2} />
          <span className={cn('text-[9px]', moreActive ? 'font-semibold' : 'font-medium')}>
            {t.nav.items.more}
          </span>
        </button>
      </GlassSurface>
    </div>
  )
}
