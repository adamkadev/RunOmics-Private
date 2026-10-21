'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Activity, CalendarDays, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { activeNavHref } from '@/lib/navigation'
import { t } from '@/i18n'
import { useHaptic } from '@/lib/useHaptic'
import { useFullscreenChromeHidden } from './FullscreenChromeContext'
import { TrophyIcon } from './TrophyIcon'

const TABS = [
  { href: '/',           label: t.nav.items.dashboard,   icon: LayoutDashboard },
  { href: '/activities', label: t.nav.items.activities,  icon: Activity },
  { href: '/plan',       label: t.nav.items.plan,        icon: CalendarDays },
  { href: '/analytics',  label: t.nav.items.analytics,   icon: BarChart2 },
  { href: '/profile',    label: t.nav.items.profile,     icon: TrophyIcon },
] as const

const TAB_HREFS = TABS.map((tab) => tab.href)

/** Scrolled past this, a scroll down shrinks the bar to its active tab. */
export const COLLAPSE_AFTER = 80
/** Scroll moves smaller than this neither shrink nor grow it: a finger's jitter. */
const SCROLL_SLOP = 4
/** iOS's own spring, as a curve: quick off the mark, settling softly. */
const SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)'

/**
 * Shrunk while the page scrolls down, whole again on a scroll up, at the top,
 * or on a tap of the shrunk button - iOS 26's tab bar, as Bevel draws it.
 */
function useCollapsed(pathname: string): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(false)
  // A new page starts with the whole bar.
  const [path, setPath] = useState(pathname)
  if (path !== pathname) {
    setPath(pathname)
    setCollapsed(false)
  }
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y <= COLLAPSE_AFTER) setCollapsed(false)
      else if (y > last + SCROLL_SLOP) setCollapsed(true)
      else if (y < last - SCROLL_SLOP) setCollapsed(false)
      else return
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])
  return [collapsed, () => setCollapsed(false)]
}

/**
 * The tab bar (owner, Oct 2026, after Bevel): a floating glass capsule over
 * the page, the active tab on a soft pill in the accent. The pill is one
 * element that glides to the tab tapped, as it is tapped, not when the next
 * page has loaded. Scrolling down shrinks the bar to one round glass button
 * with the active tab's icon, which brings the whole bar back on a tap;
 * scrolling up brings it back too.
 */
export function GlassTabBar() {
  const pathname = usePathname()
  const currentHref = activeNavHref(pathname, TAB_HREFS)
  const hidden = useFullscreenChromeHidden()
  const haptic = useHaptic()
  const [collapsed, expand] = useCollapsed(pathname)
  // The tab tapped, until its page is the one shown: the pill moves at once.
  const [tapped, setTapped] = useState<string | null>(null)
  const [shownPath, setShownPath] = useState(pathname)
  if (shownPath !== pathname) {
    setShownPath(pathname)
    setTapped(null)
  }
  const activeHref = tapped ?? currentHref
  const activeIndex = Math.max(0, TAB_HREFS.indexOf(activeHref as (typeof TAB_HREFS)[number]))
  const current = TABS.find((tab) => tab.href === currentHref) ?? TABS[0]
  const CurrentIcon = current.icon

  return (
    // Above the sticky strips (z-30), as the compact bar is at the top (v5.5
    // #2): at the same z-index the later Overview/Splits control painted over
    // the tab bar whenever it sat low on the screen.
    <nav
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 transition-transform duration-200 ease-out lg:hidden',
        // Fullscreen maps take the whole screen: the bar slides away, gap and all.
        hidden ? 'translate-y-[calc(100%+24px)]' : 'translate-y-0',
      )}
      // Clear of the home indicator's swipe zone, about 19 pt off the bottom
      // edge on a notched iPhone, as Bevel floats it.
      style={{ paddingBottom: 'var(--tab-bar-float)' }}
    >
      <div className="relative h-[58px]">
        <div
          data-testid="tab-bar-capsule"
          aria-hidden={collapsed || undefined}
          className={cn(
            'glass-float absolute inset-0 flex items-center gap-1 rounded-full p-1 transition-[opacity,transform] duration-300 motion-reduce:transition-none',
            // Shrinks towards the button it becomes, at the bottom left.
            collapsed ? 'pointer-events-none scale-[0.35] opacity-0' : 'scale-100 opacity-100',
            !hidden && !collapsed && 'pointer-events-auto',
          )}
          style={{ transformOrigin: '28px 50%', transitionTimingFunction: SPRING }}
        >
          {/* The pill: one fifth of the row less the gaps, moved a tab and a
              gap at a time (translateX's % is its own width). */}
          <span
            aria-hidden="true"
            data-testid="tab-pill"
            className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-full bg-[var(--tab-pill)] transition-transform duration-[380ms] motion-reduce:transition-none"
            style={{
              width: `calc((100% - 8px - ${(TABS.length - 1) * 4}px) / ${TABS.length})`,
              transform: `translateX(calc(${activeIndex} * (100% + 4px)))`,
              transitionTimingFunction: SPRING,
            }}
          />
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = currentHref === href
            const lit = activeHref === href
            return (
              <Link
                key={href}
                href={href}
                tabIndex={collapsed ? -1 : undefined}
                onClick={() => {
                  if (active) return
                  haptic('light')
                  setTapped(href)
                }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-full flex-1 flex-col items-center justify-center gap-[3px] rounded-full transition-[color,transform] duration-200 active:scale-95',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  lit ? 'text-accent' : 'text-muted-foreground',
                )}
              >
                <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
                <span data-testid={active ? 'tab-active' : undefined} className="text-caption font-medium leading-none">
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
        {/* Shrunk: the active tab's icon alone, which brings the bar back. */}
        <button
          type="button"
          data-testid="tab-bar-collapsed"
          aria-label={t.nav.showTabs(current.label)}
          aria-hidden={!collapsed || undefined}
          tabIndex={collapsed ? undefined : -1}
          onClick={() => {
            haptic('light')
            expand()
          }}
          className={cn(
            'glass-float absolute bottom-0 left-0 flex size-[58px] items-center justify-center rounded-full text-accent transition-[opacity,transform] duration-300 motion-reduce:transition-none',
            collapsed && !hidden ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0',
          )}
          style={{ transitionTimingFunction: SPRING }}
        >
          <CurrentIcon size={24} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
