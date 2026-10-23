'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType } from 'react'
import { LayoutDashboard, Activity, CalendarDays, BarChart2, Map, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { activeNavHref } from '@/lib/navigation'
import { t } from '@/i18n'
import { APP_VERSION } from '@/lib/version'
import { ThemeToggle } from './ThemeToggle'
import { GlassTabBar } from './GlassTabBar'
import { TrophyIcon } from './TrophyIcon'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { HeaderMark } from './HeaderMark'

const NAV_ITEMS = [
  { href: '/', label: t.nav.items.dashboard, icon: LayoutDashboard },
  { href: '/activities', label: t.nav.items.activities, icon: Activity },
  { href: '/plan', label: t.nav.items.plan, icon: CalendarDays },
  { href: '/analytics', label: t.nav.items.analytics, icon: BarChart2 },
  { href: '/map', label: t.nav.items.heatmap, icon: Map },
  { href: '/profile', label: t.nav.items.profile, icon: TrophyIcon },
]

const NAV_HREFS = [...NAV_ITEMS.map((item) => item.href), '/settings']

export function Sidebar() {
  const pathname = usePathname()
  const currentHref = activeNavHref(pathname, NAV_HREFS)

  const row = (href: string, label: string, Icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' }>) => {
    const active = currentHref === href
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-10 items-center gap-3 rounded-[9px] px-2.5 text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active
            ? 'bg-[var(--accent-soft)] font-semibold text-accent-text'
            : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-foreground'
        )}
      >
        <Icon size={18} strokeWidth={active ? 2.1 : 1.8} />
        {label}
      </Link>
    )
  }

  return (
    <>
      <GlassSurface
        as="aside"
        variant="chrome"
        className="fixed inset-y-3 left-3 z-20 hidden w-[224px] flex-col rounded-2xl px-3 py-4 lg:flex"
      >
        <Link href="/" className="flex shrink-0 items-center gap-2 border-b border-border px-2.5 pb-4 pt-1">
          <HeaderMark size={20} />
          <span className="text-[17px] font-bold tracking-[-0.01em] text-foreground">
            {t.brand.namePrefix}
            <span className="text-accent-text">{t.brand.nameSuffix}</span>
          </span>
        </Link>

        <nav className="mt-3.5 flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon }) => row(href, label, icon))}
        </nav>

        <div className="flex shrink-0 flex-col gap-0.5 border-t border-border pt-3">
          {row('/settings', t.nav.items.settings, Settings)}
          <div className="flex items-center justify-between px-2.5 pb-0.5 pt-2">
            <span className="text-xs text-subtle">{t.brand.version(APP_VERSION)}</span>
            <ThemeToggle compact />
          </div>
        </div>
      </GlassSurface>
      <GlassTabBar />
    </>
  )
}
