'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Activity, CalendarDays, Compass, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'

const TABS = [
  { href: '/',           label: t.nav.items.dashboard,  icon: LayoutDashboard },
  { href: '/activities', label: t.nav.items.activities,  icon: Activity },
  { href: '/calendar',   label: t.nav.items.calendar,    icon: CalendarDays },
  { href: '/explore',    label: t.nav.items.explore,     icon: Compass },
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

  return (
    <div className="fixed inset-x-0 bottom-3 z-30 px-6 py-2 lg:hidden">
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
