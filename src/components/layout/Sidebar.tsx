'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Activity,
  CalendarDays,
  BarChart2,
  Trophy,
  Target,
  Map,
  Footprints,
  ChevronRight,
  Settings,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { APP_VERSION } from '@/lib/version'
import { hasGlobalTopBar } from '@/lib/navigation'
import { useScrollDirection } from '@/lib/useScrollDirection'
import { useDragToDismiss } from '@/hooks/useDragToDismiss'
import { ThemeToggle } from './ThemeToggle'
import { GlassTabBar } from './GlassTabBar'
import { GlassSurface } from '@/components/ui/GlassSurface'

const NAV_ITEMS = [
  { href: '/', label: t.nav.items.dashboard, icon: LayoutDashboard },
  { href: '/activities', label: t.nav.items.activities, icon: Activity },
  { href: '/calendar', label: t.nav.items.calendar, icon: CalendarDays },
  { href: '/analytics', label: t.nav.items.analytics, icon: BarChart2 },
  { href: '/goals', label: t.nav.items.goals, icon: Target },
  { href: '/records', label: t.nav.items.records, icon: Trophy },
  { href: '/map', label: t.nav.items.heatmap, icon: Map },
  { href: '/shoes', label: t.nav.items.shoes, icon: Footprints },
  { href: '/profile', label: t.nav.items.profile, icon: User },
]

// Mobile "More" bottom sheet: only the routes not already one tap away on
// the persistent GlassTabBar (dashboard/activities/calendar/analytics).
const MORE_PRIMARY_ITEMS = [
  { href: '/goals', label: t.nav.items.goals, icon: Target },
  { href: '/records', label: t.nav.items.records, icon: Trophy },
  { href: '/map', label: t.nav.items.heatmap, icon: Map },
  { href: '/shoes', label: t.nav.items.shoes, icon: Footprints },
]
const MORE_SECONDARY_ITEMS = [
  { href: '/settings', label: t.nav.items.settings, icon: Settings },
]

// In-app brand mark: thin concentric rings inheriting the live accent color
// (var(--accent) is set on <html> before paint, so it follows the theme without JS).
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

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" onClick={onClick} className="flex items-center gap-2.5">
      <HeaderMark size={26} />
      <span className="text-2xl font-bold tracking-tight text-foreground">
        {t.brand.namePrefix}
        <span className="text-accent-text">{t.brand.nameSuffix}</span>
      </span>
    </Link>
  )
}

function MoreMenuItem({
  href,
  label,
  icon: Icon,
  onNavigate,
}: {
  href: string
  label: string
  icon: typeof Target
  onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-colors active:bg-foreground/[0.06]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.08] text-foreground/70">
        <Icon size={20} strokeWidth={1.8} />
      </span>
      <span className="text-base font-semibold text-foreground">{label}</span>
      <ChevronRight size={16} className="ml-auto shrink-0 text-foreground/25" />
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { handleProps, sheetStyle } = useDragToDismiss(() => setOpen(false))
  const headerHidden = useScrollDirection()
  const showTopBar = hasGlobalTopBar(pathname)

  // Lock background scroll while the mobile menu is open.
  useEffect(() => {
    if (!open) return
    const { style: htmlStyle } = document.documentElement
    const { style: bodyStyle } = document.body
    const prevHtml = htmlStyle.overflow
    const prevBody = bodyStyle.overflow
    htmlStyle.overflow = 'hidden'
    bodyStyle.overflow = 'hidden'
    return () => {
      htmlStyle.overflow = prevHtml
      bodyStyle.overflow = prevBody
    }
  }, [open])

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
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
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
                pathname === '/settings'
                  ? 'text-accent-text'
                  : 'text-subtle hover:text-muted-foreground'
              )}
              title={t.nav.items.settings}
            >
              <Settings size={16} />
            </Link>
          </div>
          <ThemeToggle />
        </div>
      </GlassSurface>

      {/* ─── Mobile top bar — everywhere except Profile/Settings, which show their own header ─── */}
      {showTopBar && (
        <header
          className={cn(
            'fixed inset-x-0 top-0 z-30 transition-transform duration-200 ease-out lg:hidden',
            headerHidden ? '-translate-y-full' : 'translate-y-0'
          )}
          style={{ paddingTop: 'max(calc(env(safe-area-inset-top) - 10px), 8px)' }}
        >
          <div className="relative flex h-14 items-center justify-center px-4">
            <Brand />
            <Link
              href="/profile"
              className="absolute right-4 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-muted-foreground transition-colors active:scale-90"
              aria-label={t.nav.items.profile}
            >
              <User size={16} />
            </Link>
          </div>
        </header>
      )}

      {/* ─── Mobile glass tab bar ─── */}
      <GlassTabBar onMore={() => setOpen(true)} moreOpen={open} />

      {/* ─── Mobile "More" bottom sheet (N1) ─── */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[4px] lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <GlassSurface
        as="div"
        variant="sheet"
        role="menu"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] border-b-0 transition-transform duration-300 lg:hidden',
          open ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        )}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)', ...sheetStyle }}
      >
        <div className="flex justify-center pt-3 pb-3" {...handleProps}>
          <div className="h-[5px] w-[38px] rounded-full bg-foreground/[0.18]" />
        </div>

        <nav className="flex flex-col gap-1 px-4">
          {MORE_PRIMARY_ITEMS.map((item) => (
            <MoreMenuItem key={item.href} {...item} onNavigate={() => setOpen(false)} />
          ))}
        </nav>

        <div className="mx-5 my-2 h-px bg-foreground/[0.06]" />

        <nav className="flex flex-col gap-1 px-4">
          {MORE_SECONDARY_ITEMS.map((item) => (
            <MoreMenuItem key={item.href} {...item} onNavigate={() => setOpen(false)} />
          ))}
        </nav>

        <p className="pt-3 text-center text-xs text-foreground/20">{t.brand.version(APP_VERSION)}</p>
      </GlassSurface>
    </>
  )
}
