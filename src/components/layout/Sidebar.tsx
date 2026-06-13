'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Activity,
  CalendarDays,
  BarChart2,
  Trophy,
  HeartPulse,
  Map,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './ThemeToggle'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { href: '/activities', label: 'Activities', short: 'Runs', icon: Activity },
  { href: '/calendar', label: 'Calendar', short: 'Calendar', icon: CalendarDays },
  { href: '/analytics', label: 'Analytics', short: 'Stats', icon: BarChart2 },
  { href: '/goals', label: 'Goals & PBs', short: 'Goals', icon: Trophy },
  { href: '/map', label: 'Heatmap', short: 'Map', icon: Map },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <HeartPulse size={20} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            Runomics
          </span>
        </div>

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
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
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
          <span className="text-xs text-subtle">Runomics v1.0</span>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-2">
          <HeartPulse size={18} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-base font-bold tracking-tight text-foreground">
            Runomics
          </span>
        </div>
        <ThemeToggle />
      </header>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="grid grid-cols-6">
          {NAV_ITEMS.map(({ href, short, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-0.5 pb-2 pt-2 text-[11px] font-medium transition-all duration-200',
                  active ? 'text-accent-text' : 'text-muted-foreground'
                )}
              >
                <span
                  className={cn(
                    'mb-0.5 flex items-center justify-center rounded-full px-4 py-1 transition-all duration-200',
                    active ? 'bg-accent-subtle' : ''
                  )}
                >
                  <Icon size={20} />
                </span>
                {short}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
