'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Activity, CalendarDays, Compass, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'

const TABS = [
  { href: '/',           label: t.nav.items.dashboard,  icon: LayoutDashboard },
  { href: '/activities', label: t.nav.items.activities,  icon: Activity },
  { href: '/calendar',   label: t.nav.items.calendar,    icon: CalendarDays },
  { href: '/explore',    label: t.nav.items.explore,     icon: Compass },
  { href: '/profile',    label: t.nav.items.profile,     icon: User },
] as const

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

const tabClass = 'flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-colors active:scale-95'

export function GlassTabBar() {
  const pathname = usePathname()

  return (
    <div className="fixed inset-x-0 bottom-3 z-30 px-6 py-2 lg:hidden">
      <GlassSurface
        as="nav"
        variant="nav"
        className="flex items-center justify-between rounded-full px-4 py-2.5"
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
              <Icon size={22} strokeWidth={1.75} />
              <span className={cn('text-micro', active ? 'font-semibold' : 'font-medium')}>
                {label}
              </span>
            </Link>
          )
        })}
      </GlassSurface>
    </div>
  )
}