'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Activity, CalendarDays, BarChart2, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { useFullscreenChromeHidden } from './FullscreenChromeContext'

const TABS = [
  { href: '/',           label: t.nav.items.dashboard,  icon: LayoutDashboard },
  { href: '/activities', label: t.nav.items.activities,  icon: Activity },
  { href: '/calendar',   label: t.nav.items.calendar,    icon: CalendarDays },
  { href: '/analytics',  label: t.nav.items.analytics,   icon: BarChart2 },
  { href: '/profile',    label: t.nav.items.profile,     icon: User },
] as const

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

const N = TABS.length
const PAD = 8 // matches px-2 = 8px

export function GlassTabBar() {
  const pathname = usePathname()
  const activeIndex = TABS.findIndex(({ href }) => isActive(pathname, href))
  const hidden = useFullscreenChromeHidden()

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 px-6 pt-2 transition-transform duration-200 ease-out lg:hidden',
        hidden ? 'pointer-events-none translate-y-[calc(100%+2rem)]' : 'translate-y-0'
      )}
      style={{ paddingBottom: 'max(12px, var(--safe-bottom))' }}
    >
      <GlassSurface
        as="nav"
        variant="nav"
        className="relative flex items-center rounded-full px-2 py-2"
      >
        {activeIndex >= 0 && (
          <span
            className="pointer-events-none absolute top-1.5 bottom-1.5 rounded-full bg-accent/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-[left] duration-[300ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            style={{
              left: `calc(${PAD}px + ${activeIndex} * (100% - ${PAD * 2}px) / ${N})`,
              width: `calc((100% - ${PAD * 2}px) / ${N})`,
            }}
          />
        )}
        {TABS.map(({ href, label, icon: Icon }, i) => {
          const active = i === activeIndex
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-colors active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-2xl',
                active ? 'text-accent-text' : 'text-muted-foreground'
              )}
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
