'use client'

import { useEffect, useRef, useState } from 'react'
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
  Menu,
  X,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { APP_VERSION } from '@/lib/version'
import { ThemeToggle } from './ThemeToggle'

const NAV_ITEMS = [
  { href: '/', label: t.nav.items.dashboard, icon: LayoutDashboard },
  { href: '/activities', label: t.nav.items.activities, icon: Activity },
  { href: '/calendar', label: t.nav.items.calendar, icon: CalendarDays },
  { href: '/analytics', label: t.nav.items.analytics, icon: BarChart2 },
  { href: '/goals', label: t.nav.items.goals, icon: Target },
  { href: '/records', label: t.nav.items.records, icon: Trophy },
  { href: '/map', label: t.nav.items.heatmap, icon: Map },
  { href: '/shoes', label: t.nav.items.shoes, icon: Footprints },
]

// In-app brand mark: thin concentric rings inheriting the live accent color
// (var(--accent) is set on <html> before paint, so it follows the theme without JS).
function HeaderMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      style={{ color: 'var(--accent)' }}
      role="img"
      aria-label=""
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="9" strokeWidth="5" />
      <circle cx="32" cy="32" r="16.5" strokeWidth="5" strokeOpacity="0.55" />
      <circle cx="32" cy="32" r="24" strokeWidth="5" strokeOpacity="0.28" />
    </svg>
  )
}

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" onClick={onClick} className="flex items-center gap-2.5">
      <HeaderMark size={26} />
      <span className="text-2xl tracking-tight text-foreground">
        <span className="font-bold">{t.brand.namePrefix}</span>
        <span className="font-normal">{t.brand.nameSuffix}</span>
      </span>
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const [headerOffset, setHeaderOffset] = useState(0)

  // Slide the mobile top bar up gradually as the page scrolls down. Reveal it
  // again only on a deliberate upward scroll (a small threshold ignores the
  // bounce/toolbar shift that fires when scrolling stops), never on stop alone.
  useEffect(() => {
    const REVEAL_THRESHOLD = 8
    let lastY = window.scrollY
    let upAccum = 0
    function onScroll() {
      const y = window.scrollY
      const h = headerRef.current?.offsetHeight ?? 56
      const delta = y - lastY
      lastY = y

      if (y <= 0) {
        upAccum = 0
        setHeaderOffset(0)
        return
      }
      if (delta > 0) {
        upAccum = 0
        setHeaderOffset((prev) => Math.min(h, prev + delta))
      } else if (delta < 0) {
        upAccum -= delta
        if (upAccum > REVEAL_THRESHOLD) {
          setHeaderOffset((prev) => Math.max(0, prev + delta))
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-border bg-card lg:flex">
        <Link href="/" className="flex h-16 items-center gap-2 border-b border-border px-5">
          <HeaderMark size={22} />
          <span className="text-lg tracking-tight text-foreground">
            <span className="font-bold">{t.brand.namePrefix}</span>
            <span className="font-normal">{t.brand.nameSuffix}</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-0.5 p-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent-subtle text-accent-text'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
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
              <Settings size={14} />
            </Link>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* ─── Mobile top bar ─── */}
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-30 bg-card lg:hidden"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          transform: `translateY(-${headerOffset}px)`,
        }}
      >
        <div className="relative flex h-14 items-center justify-center border-b border-border px-4">
          <div className="absolute left-4">
            <ThemeToggle />
          </div>
          <Brand />
          <button
            onClick={() => setOpen(true)}
            className="absolute right-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t.nav.openMenu}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* ─── Mobile full-screen menu ─── */}
      <div
        className={cn(
          'fixed inset-0 z-50 flex flex-col bg-card lg:hidden transition-transform duration-300',
          open ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
        )}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <Brand onClick={() => setOpen(false)} />
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t.nav.closeMenu}
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-6 pt-4">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-5 rounded-2xl px-4 py-4 transition-colors',
                  active ? 'text-accent-text' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon size={26} />
                <span className="text-3xl font-bold tracking-tight">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-subtle">{t.brand.version(APP_VERSION)}</span>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-2 text-sm transition-colors',
              pathname === '/settings'
                ? 'text-accent-text'
                : 'text-subtle hover:text-muted-foreground'
            )}
          >
            <Settings size={16} />
            {t.nav.items.settings}
          </Link>
        </div>
      </div>
    </>
  )
}
