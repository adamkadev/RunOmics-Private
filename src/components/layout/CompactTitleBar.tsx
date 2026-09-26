'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * iOS's large-title behaviour (v4.3.2): once the page's large title has
 * scrolled under the top bar, the bar shows it again as a centred 17 pt
 * title, instead of leaving it cut in half under the status bar. The bar is
 * opaque and flat, so it also reads as the status bar's own strip.
 *
 * The title is the page's own <h1>, read from the DOM: every page already
 * has one, and a page that has none simply never shows the bar.
 */
/** The bar under the status bar: iOS's 44 pt navigation bar. */
const BAR_HEIGHT = 44

export function CompactTitleBar() {
  const pathname = usePathname()
  const barRef = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    let frame = 0
    let heading: HTMLElement | null = null

    const measure = () => {
      frame = 0
      const current = document.querySelector<HTMLElement>('main h1')
      if (current !== heading) {
        heading = current
        setTitle(current?.textContent?.trim() || null)
      }
      const bar = barRef.current
      if (!heading || !bar) {
        setShown(false)
        return
      }
      // The large title sits right under the status bar at rest, inside the
      // bar's height, so the bar waits for it to start going under the
      // status bar itself - the moment it would be cut.
      const statusBar = bar.offsetHeight - BAR_HEIGHT
      setShown(window.scrollY > 0 && heading.getBoundingClientRect().top < statusBar)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    // A client page swaps its content (a tab, a loaded list) without a route
    // change, so the heading is looked up again whenever <main> changes.
    const main = document.querySelector('main')
    const observer = main ? new MutationObserver(schedule) : null
    if (main) observer!.observe(main, { childList: true, subtree: true, characterData: true })

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [pathname])

  const visible = shown && title !== null

  return (
    <div
      ref={barRef}
      data-testid="compact-title-bar"
      data-shown={visible ? '' : undefined}
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-20 flex items-end justify-center border-b transition-opacity duration-150 lg:hidden',
        visible ? 'opacity-100' : 'opacity-0',
      )}
      style={{
        height: `calc(var(--safe-top) + ${BAR_HEIGHT}px)`,
        paddingTop: 'var(--safe-top)',
        background: 'var(--background)',
        borderColor: 'var(--divider)',
      }}
    >
      <span className="block h-11 max-w-[70%] truncate text-[17px] font-semibold leading-[44px] text-foreground">
        {title}
      </span>
    </div>
  )
}
