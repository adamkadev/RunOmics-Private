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

/** Where a sticky strip (the activity and Analytics tabs) sits while the bar
 *  shows: under it, not over it (v4.3.3). Unset, each strip keeps its own. */
export const STICKY_TOP_VAR = '--sticky-top'

/** The line under the large title that fades as it scrolls up. */
function subtitleOf(heading: HTMLElement): HTMLElement[] {
  const marked = [...(heading.parentElement?.querySelectorAll<HTMLElement>('[data-title-sub]') ?? [])]
  const next = heading.nextElementSibling
  return next instanceof HTMLElement && next.tagName === 'P' && !marked.includes(next) ? [next, ...marked] : marked
}

export function CompactTitleBar() {
  const pathname = usePathname()
  // The safe area, measured: the bar itself is not drawn while hidden, so it
  // has no height to read.
  const probeRef = useRef<HTMLSpanElement>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    let frame = 0
    let heading: HTMLElement | null = null
    // Each subtitle line with its top edge at rest, in page coordinates.
    let subtitles: { el: HTMLElement; restTop: number }[] = []

    const release = () => {
      for (const { el } of subtitles) el.style.opacity = ''
      subtitles = []
    }

    const measure = () => {
      frame = 0
      const current = document.querySelector<HTMLElement>('main h1')
      if (current !== heading) {
        release()
        heading = current
        setTitle(current?.textContent?.trim() || null)
        if (current) {
          subtitles = subtitleOf(current).map((el) => ({ el, restTop: el.getBoundingClientRect().top + window.scrollY }))
        }
      }
      if (!heading) {
        setShown(false)
        return
      }
      const statusBar = probeRef.current?.offsetHeight ?? 0
      const barBottom = statusBar + BAR_HEIGHT
      // The large title sits right under the status bar at rest, inside the
      // bar's height, so the bar waits for it to start going under the
      // status bar itself - the moment it would be cut.
      setShown(window.scrollY > 0 && heading.getBoundingClientRect().top < statusBar)
      // The subtitle fades with the scroll and is gone by the time its top
      // edge reaches the bar's divider, so no clipped glyphs show under it.
      for (const { el, restTop } of subtitles) {
        const travel = restTop - barBottom
        if (travel <= 0) continue
        const left = el.getBoundingClientRect().top - barBottom
        el.style.opacity = String(Math.min(1, Math.max(0, left / travel)))
      }
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
      release()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [pathname])

  const visible = shown && title !== null

  useEffect(() => {
    const root = document.documentElement
    if (visible) root.style.setProperty(STICKY_TOP_VAR, `calc(var(--safe-top) + ${BAR_HEIGHT}px)`)
    else root.style.removeProperty(STICKY_TOP_VAR)
    return () => {
      root.style.removeProperty(STICKY_TOP_VAR)
    }
  }, [visible])

  return (
    <>
      <span
        ref={probeRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 w-0"
        style={{ height: 'var(--safe-top)' }}
      />
      <div
        data-testid="compact-title-bar"
        data-shown={visible ? '' : undefined}
        aria-hidden="true"
        // Hidden, the bar is not drawn at all, and shown it is fully opaque:
        // iOS 26 takes the topmost fixed element touching the top edge as the
        // page's bar, and a transparent one (opacity 0) brought its scroll-edge
        // blur back over the status bar. Only the title fades in. Above the
        // sticky tab strips (z-30), which move under it while it shows.
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 z-40 items-end justify-center border-b lg:hidden',
          visible ? 'flex' : 'hidden',
        )}
        style={{
          height: `calc(var(--safe-top) + ${BAR_HEIGHT}px)`,
          paddingTop: 'var(--safe-top)',
          background: 'var(--background)',
          borderColor: 'var(--divider)',
        }}
      >
        <span className="block h-11 max-w-[70%] animate-[fade-in_150ms_ease-out] truncate text-[17px] font-semibold leading-[44px] text-foreground">
          {title}
        </span>
      </div>
    </>
  )
}
