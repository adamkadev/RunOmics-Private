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
  HeartPulse,
  Map,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './ThemeToggle'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/activities', label: 'Activities', icon: Activity },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/goals', label: 'Goals & PBs', icon: Trophy },
  { href: '/map', label: 'Heatmap', icon: Map },
]

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <HeartPulse size={24} className="text-emerald-600 dark:text-emerald-400" />
      <span className="text-2xl tracking-tight text-foreground">
        <span className="font-bold">Run</span>
        <span className="font-normal">Omics</span>
      </span>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <HeartPulse size={20} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-lg tracking-tight text-foreground">
            <span className="font-bold">Run</span>
            <span className="font-normal">Omics</span>
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
          <span className="text-xs text-subtle">RunOmics v1.0</span>
          <ThemeToggle />
        </div>
      </aside>

      <header
        className="fixed inset-x-0 top-0 z-30 bg-card lg:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="relative flex h-14 items-center justify-center border-b border-border px-4">
          <div className="absolute left-4">
            <ThemeToggle />
          </div>
          <Brand />
          <button
            onClick={() => setOpen(true)}
            className="absolute right-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

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
          <Brand />
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close menu"
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
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-foreground/70 hover:text-foreground'
                )}
              >
                <Icon
                  size={26}
                  className={active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}
                />
                <span className="text-3xl font-bold tracking-tight">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="shrink-0 border-t border-border px-6 py-4">
          <span className="text-sm text-subtle">RunOmics v1.0</span>
        </div>
      </div>
    </>
  )
}
