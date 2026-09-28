'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Activity, CalendarDays, BarChart2, Map, Settings, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { activeNavHref } from '@/lib/navigation'
import { t } from '@/i18n'
import { APP_VERSION } from '@/lib/version'
import { ThemeToggle } from './ThemeToggle'
import { GlassTabBar } from './GlassTabBar'
import { GlassSurface } from '@/components/ui/GlassSurface'

const NAV_ITEMS = [
  { href: '/', label: t.nav.items.dashboard, icon: LayoutDashboard },
  { href: '/activities', label: t.nav.items.activities, icon: Activity },
  { href: '/plan', label: t.nav.items.plan, icon: CalendarDays },
  { href: '/analytics', label: t.nav.items.analytics, icon: BarChart2 },
  { href: '/map', label: t.nav.items.heatmap, icon: Map },
  { href: '/profile', label: t.nav.items.profile, icon: User },
]

const NAV_HREFS = [...NAV_ITEMS.map((item) => item.href), '/settings']

function HeaderMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      className="text-accent-text"
      role="img"
      aria-hidden="true"
    >
      <path d="M 6 16 A 16 8 0 0 1 38 16" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="6" y1="16" x2="6" y2="28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
      <line x1="38" y1="16" x2="38" y2="28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
      <path d="M 6 28 A 16 8 0 0 0 38 28" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" opacity="0.45" />
      <path d="M 6 28 A 16 8 0 0 1 38 28" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="6" y1="28" x2="6" y2="40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
      <line x1="38" y1="28" x2="38" y2="40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
      <path d="M 6 40 A 16 8 0 0 0 38 40" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const currentHref = activeNavHref(pathname, NAV_HREFS)

  // One row recipe for the six sections and Settings (v4.17): 40 px tall,
  // an 18 px icon 12 px from its label; the section on screen takes the
  // accent on its soft tint.
  const row = (href: string, label: string, Icon: typeof Settings) => {
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

        {/* Settings is a nav row of its own, pinned above the version and
            the theme toggle (v4.17). */}
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
