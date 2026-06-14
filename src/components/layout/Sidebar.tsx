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
      <span className="text-2xl font-bold tracking-tight text-foreground">Runomics</span>
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
          <span className="text-lg font-bold tracking-tight text-foreground">Runomics</span>
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

      <header
        className="fixed inset-x-0 top-0 z-30 bg-card lg:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="relative flex h-14 items-center justify-center border-b border-border px-4">
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
          'fixed inset-0 z-40 lg:hidden transition-opacity duration-300',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />

        <div
          className={cn(
            'absolute right-0 top-0 bottom-0 flex w-72 flex-col bg-card shadow-xl transition-transform duration-300',
            open ? 'translate-x-0' : 'translate-x-full'
          )}
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="flex h-14 items-center justify-between border-b border-border px-5">
            <Brand />
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
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
        </div>
      </div>
    </>
  )
}
