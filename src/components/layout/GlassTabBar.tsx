'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Activity, CalendarDays, BarChart2, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { useHaptic } from '@/lib/useHaptic'
import { useFullscreenChromeHidden } from './FullscreenChromeContext'

const TABS = [
  { href: '/',           label: t.nav.items.dashboard,  icon: LayoutDashboard },
  { href: '/activities', label: t.nav.items.activities,  icon: Activity },
  { href: '/plan',       label: t.nav.items.plan,        icon: CalendarDays },
  { href: '/analytics',  label: t.nav.items.analytics,   icon: BarChart2 },
  { href: '/profile',    label: t.nav.items.profile,     icon: User },
] as const

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export function GlassTabBar() {
  const pathname = usePathname()
  const hidden = useFullscreenChromeHidden()
  const haptic = useHaptic()

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-border/70 bg-background/95 backdrop-blur-md transition-transform duration-200 ease-out lg:hidden',
        hidden ? 'pointer-events-none translate-y-full' : 'translate-y-0'
      )}
      style={{ paddingBottom: 'max(10px, var(--safe-bottom))' }}
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            onClick={() => { if (!active) haptic('light') }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors active:scale-95',
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
    </nav>
  )
}
