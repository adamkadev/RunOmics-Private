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

  return (
    <>
      {/* ─── Desktop sidebar ─── */}
      <GlassSurface
        as="aside"
        variant="chrome"
        className="fixed inset-y-3 left-3 z-20 hidden w-[220px] flex-col rounded-2xl lg:flex"
      >
        <Link href="/" className="flex h-16 shrink-0 items-center gap-2.5 px-5">
          <HeaderMark size={22} />
          <span className="text-lg font-bold tracking-tight text-foreground">
            {t.brand.namePrefix}
            <span className="text-accent-text">{t.brand.nameSuffix}</span>
          </span>
        </Link>

        <div className="mx-4 h-px shrink-0 bg-foreground/[0.08]" />

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = currentHref === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-accent/[0.12] font-semibold text-accent-text'
                    : 'text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground'
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="mx-4 h-px shrink-0 bg-foreground/[0.08]" />

        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-subtle">{t.brand.version(APP_VERSION)}</span>
            <Link
              href="/settings"
              className={cn(
                'rounded-md p-1 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                currentHref === '/settings'
                  ? 'text-accent-text'
                  : 'text-subtle hover:text-muted-foreground'
              )}
              // title alone is a last-resort accessible name and shows nothing
              // on touch, so the icon-only link carries an explicit label.
              aria-label={t.nav.items.settings}
              title={t.nav.items.settings}
            >
              <Settings size={16} />
            </Link>
          </div>
          <ThemeToggle />
        </div>
      </GlassSurface>
      <GlassTabBar />
    </>
  )
}
