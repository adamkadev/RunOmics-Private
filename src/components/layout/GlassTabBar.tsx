'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Activity, CalendarDays, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { activeNavHref } from '@/lib/navigation'
import { t } from '@/i18n'
import { useHaptic } from '@/lib/useHaptic'
import { useFullscreenChromeHidden } from './FullscreenChromeContext'
import { TrophyIcon } from './TrophyIcon'
import { GlassLayers } from '@/components/ui/GlassSurface'
import { SPRING, useTabLens } from './useTabLens'

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
 * the page, the active tab on a soft pill in the accent. Liquid Glass v3
 * (G3, G4): 62 pt, 24 pt from the screen's sides and foot - concentric with
 * the display's 55 pt corner - the other tabs in label ink, and pressing and
 * dragging turns the pill into a clear lens that follows the finger
 * (useTabLens). The pill is one
 * element that glides to the tab tapped, as it is tapped, not when the next
 * page has loaded. Scrolling down shrinks the bar to one round glass button
 * with the active tab's icon, which brings the whole bar back on a tap;
 * scrolling up brings it back too.
 */
export function GlassTabBar() {
  const pathname = usePathname()
  const router = useRouter()
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
  const { rowRef, lens, rowHandlers } = useTabLens({
    count: TABS.length,
    activeIndex,
    haptic,
    onCommit: (index) => {
      const href = TABS[index]!.href
      haptic('light')
      setTapped(href)
      router.push(href)
    },
  })

  return (
    // Above the sticky strips (z-30), as the compact bar is at the top (v5.5
    // #2): at the same z-index the later Overview/Splits control painted over
    // the tab bar whenever it sat low on the screen.
    <nav
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 px-6 transition-transform duration-200 ease-out lg:hidden',
        // Fullscreen maps take the whole screen: the bar slides away, gap and all.
        hidden ? 'translate-y-[calc(100%+24px)]' : 'translate-y-0',
      )}
      // Clear of the home indicator's swipe zone: 24 pt off the bottom edge
      // on a Face ID iPhone, as off the sides (Liquid Glass v3, G3).
      style={{ paddingBottom: 'var(--tab-bar-float)' }}
    >
      {/* Blur and tint under the bar only, from the screen's edge to the
          capsule, nothing over the page above it (owner, Oct 2026). */}
      <div aria-hidden="true" data-testid="bottom-glass" className="bottom-edge"><i /><i /></div>
      <div className="relative h-[var(--tab-bar-h)]">
        {/* One glass surface that morphs (owner's brief, Oct 2026): its width
            springs between the full row and the 58 pt bubble, never two
            objects cross-fading. */}
        <div
          data-testid="tab-bar-capsule"
          data-collapsed={collapsed || undefined}
          className={cn(
            // lg-tab: the tab bar's denser glass, so the labels read over the page.
            'lg lg-tab absolute bottom-0 left-0 h-[var(--tab-bar-h)] motion-reduce:transition-none',
            // Clipped only while it shrinks: the lens grows past the bar.
            collapsed && 'overflow-hidden',
            !hidden && 'pointer-events-auto',
          )}
          style={{ width: collapsed ? 'var(--tab-bar-h)' : '100%', transition: `width 420ms ${SPRING}, transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)` }}
        >
          <GlassLayers />
          {/* The full row, at a fixed width so the tabs don't squash while the glass narrows. */}
          <div
            aria-hidden={collapsed || undefined}
            className={cn(
              'absolute inset-y-0 left-0 w-[calc(100vw-48px)] p-1 transition-opacity duration-150',
              collapsed ? 'pointer-events-none opacity-0' : 'opacity-100 delay-75',
            )}
          >
            {/* The track the pill and the lens move on: the row inside the
                capsule's 4 pt, only it taking a sideways drag from the page. */}
            <div ref={rowRef} {...rowHandlers} className="relative flex h-full" style={{ touchAction: 'none' }}>
            <Platter index={activeIndex} count={TABS.length} lens={lens} />
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
                    draggable={false}
                  className={cn(
                    'relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    lit ? 'text-accent-text' : 'text-foreground',
                  )}
                >
                  <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
                  <span data-testid={active ? 'tab-active' : undefined} className={cn('text-tab', lit ? 'font-semibold' : 'font-medium')}>
                    {label}
                  </span>
                </Link>
              )
            })}
            </div>
          </div>
          {/* Minimized: the active icon inside the same glass, which brings the bar back. */}
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
              'lg-press absolute left-0 top-0 flex size-[var(--tab-bar-h)] items-center justify-center rounded-full text-accent-text transition-opacity duration-150',
              collapsed && !hidden ? 'pointer-events-auto opacity-100 delay-150' : 'pointer-events-none opacity-0',
            )}
          >
            <CurrentIcon size={26} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  )
}

/**
 * The selection platter: a flat --tab-pill fill under the active tab at
 * rest, gliding between tabs; pressed, a clear-glass lens that grows past
 * the bar (9 pt above and below, 10 at the sides) and follows the finger.
 */
function Platter({ index, count, lens }: { index: number; count: number; lens: { x: number; idx: number } | null }) {
  const share = `${100 / count}%`
  const grow = '180ms cubic-bezier(0.2, 0.9, 0.3, 1.2)'
  return (
    <span
      aria-hidden="true"
      data-testid="tab-pill"
      data-lens={lens ? '' : undefined}
      data-pressed={lens ? '' : undefined}
      className={cn('pointer-events-none absolute left-0 rounded-full motion-reduce:transition-none', lens && 'lg lg-clear')}
      style={{
        top: lens ? -9 : 0,
        bottom: lens ? -9 : 0,
        width: lens ? `calc(${share} + 20px)` : share,
        background: lens ? undefined : 'var(--tab-pill)',
        boxShadow: lens ? undefined : 'none',
        transform: lens ? `translateX(calc(${lens.x}px - 50%))` : `translateX(${index * 100}%)`,
        transition: lens
          ? `top ${grow}, bottom ${grow}, width ${grow}`
          : `transform 420ms ${SPRING}, top 260ms ${SPRING}, bottom 260ms ${SPRING}, width 260ms ${SPRING}`,
      }}
    >
      {lens && <GlassLayers />}
    </span>
  )
}
