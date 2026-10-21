'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronLeft, Settings, Share, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

/**
 * iOS's large-title behaviour (v4.3.2): once the page has scrolled, the bar
 * under the status bar shows the page's title again as a centred 17 pt
 * title, instead of leaving it cut in half under the status bar. While it
 * shows, the status strip grows down behind it as one frosted surface from
 * the notch to a hairline under the bar, as Bevel's top is (globals.css,
 * data-bar-shown; owner, Oct 2026): the bar itself is clear and holds the
 * title between its glass buttons.
 *
 * Collapsed, it is the design review's bar (Oct 2026): 52 pt, the title
 * centred, a 44 x 44 back chevron on a page reached from another, and the
 * page's one action at the trailing end - the activity's Share.
 *
 * The bar draws nothing of its own. The title is the page's own <h1>, the
 * way back the page's BackButton (`data-bar-back`) and the action the
 * control marked `data-bar-action`, all read from the DOM: the chevron and
 * the action press the page's own controls, so they do just what those do.
 * A page with no <h1> never shows the bar.
 */
export const BAR_HEIGHT = 52

/**
 * How far the page scrolls before the bar collapses in (design review, Oct
 * 2026): past the back link, which is about this tall with its margin. A
 * tab's own page collapses sooner, once its large title - its first line -
 * reaches the status bar, so the title is never left cut under it.
 */
export const COLLAPSE_SCROLL = 24

/** The large title and the bar's cross-fade (design review, Oct 2026). */
export const TITLE_FADE_MS = 150

/** Where a sticky strip (the activity and Analytics tabs) sits while the bar
 *  shows: under it, not over it (v4.3.3). Unset, each strip keeps its own. */
export const STICKY_TOP_VAR = '--sticky-top'

/**
 * A page 1-2 pt down is still at its top (v4.6 2b): a tab swap could leave
 * that much behind, which showed the bar and faded the title a little.
 */
export const SCROLL_TOP_TOLERANCE = 2

/**
 * A section label between cards (`data-bar-fade`) fades over its last 16 pt
 * before the bar's divider, about its own line, so no cut caps show under it
 * ("DATA" in Settings, design review, Oct 2026).
 */
const LABEL_FADE = 16

/** The bar is a phone's (lg:hidden): a wide screen keeps the page's header. */
const WIDE = '(min-width: 64rem)'

/**
 * The actions a page can hand the bar, as the icon it shows there: the
 * activity's Share and Progress' Settings gear. `avatar` (Today's link to
 * Progress) shows the page's own initials instead (owner, Oct 2026).
 */
const ACTION_ICONS: Record<string, LucideIcon> = { share: Share, settings: Settings }

/** The line under the large title that fades as it scrolls up. */
function subtitleOf(heading: HTMLElement): HTMLElement[] {
  const marked = [...(heading.parentElement?.querySelectorAll<HTMLElement>('[data-title-sub]') ?? [])]
  const next = heading.nextElementSibling
  return next instanceof HTMLElement && next.tagName === 'P' && !marked.includes(next) ? [next, ...marked] : marked
}

/** What a control is called: its label, or its text. */
function nameOf(el: HTMLElement): string {
  return el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''
}

/**
 * An opacity under 1 as an inline style, and none at all once fully shown
 * (v4.17): an `opacity: 1` written before a client page hydrates was a
 * hydration mismatch. Faded out, it takes no taps either: the back link and
 * Today's sync line are controls, and an invisible one went on answering.
 */
function fadeTo(el: HTMLElement, opacity: number) {
  if (opacity >= 1) el.style.removeProperty('opacity')
  else el.style.opacity = String(Math.max(0, opacity))
  if (opacity <= 0) el.style.pointerEvents = 'none'
  else el.style.removeProperty('pointer-events')
}

/** An element as the page drew it, whatever the bar faded. */
function unfade(el: HTMLElement) {
  el.style.removeProperty('opacity')
  el.style.removeProperty('pointer-events')
}

/** The large title as it is at the top: no inline style at all, not even
 *  opacity 1, so nothing keeps it on a layer of its own (v4.6). */
function restTitle(heading: HTMLElement) {
  for (const property of ['opacity', 'transform', 'filter', 'transition']) heading.style.removeProperty(property)
}

export function CompactTitleBar() {
  const pathname = usePathname()
  // The safe area, measured: the bar itself is not drawn while hidden, so it
  // has no height to read.
  const probeRef = useRef<HTMLSpanElement>(null)
  // The page's own back link and action, which the bar's buttons press.
  const backRef = useRef<HTMLElement | null>(null)
  const actionRef = useRef<HTMLElement | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const [back, setBack] = useState<string | null>(null)
  const [action, setAction] = useState<string | null>(null)
  const [actionName, setActionName] = useState('')
  const [actionText, setActionText] = useState('')

  useEffect(() => {
    let frame = 0
    let heading: HTMLElement | null = null
    // The large title's top edge at rest, in page coordinates.
    let headingRest = 0
    // Each subtitle line with its top edge at rest, in page coordinates.
    let subtitles: { el: HTMLElement; restTop: number }[] = []
    // The back link, the action and the section labels faded so far, to
    // give back as they were.
    const faded = new Set<HTMLElement>()

    // Everything the bar faded, back as the page drew it.
    const clear = () => {
      if (heading) restTitle(heading)
      for (const { el } of subtitles) unfade(el)
      for (const el of faded) unfade(el)
      faded.clear()
    }

    const measure = () => {
      frame = 0
      const current = document.querySelector<HTMLElement>('main h1')
      if (current !== heading) {
        clear()
        heading = current
        subtitles = []
        setTitle(current?.textContent?.trim() || null)
        if (current) {
          headingRest = current.getBoundingClientRect().top + window.scrollY
          subtitles = subtitleOf(current).map((el) => ({ el, restTop: el.getBoundingClientRect().top + window.scrollY }))
        }
      }
      const backLink = document.querySelector<HTMLElement>('main [data-bar-back]')
      const pageAction = document.querySelector<HTMLElement>('main [data-bar-action]')
      backRef.current = backLink
      actionRef.current = pageAction
      setBack(backLink ? nameOf(backLink) : null)
      setAction(pageAction?.dataset.barAction ?? null)
      setActionName(pageAction ? nameOf(pageAction) : '')
      setActionText(pageAction?.textContent?.trim() ?? '')
      if (!heading || window.matchMedia(WIDE).matches) {
        clear()
        setShown(false)
        return
      }

      const scroll = window.scrollY
      const statusBar = probeRef.current?.offsetHeight ?? 0
      const barBottom = statusBar + BAR_HEIGHT
      const atTop = scroll <= SCROLL_TOP_TOLERANCE
      // The scroll the bar collapses in at: 24 pt, or less where the large
      // title meets the status bar first. A title under a hero
      // (`data-title-late`, the activity's map) is on screen well past
      // 24 pt, so the bar waits until the title reaches it.
      const collapseAt = heading.hasAttribute('data-title-late')
        ? Math.max(SCROLL_TOP_TOLERANCE + 1, headingRest - barBottom)
        : Math.max(SCROLL_TOP_TOLERANCE + 1, Math.min(COLLAPSE_SCROLL, headingRest - statusBar))
      const collapsed = !atTop && scroll >= collapseAt
      setShown(collapsed)

      if (atTop) {
        restTitle(heading)
        // At rest is where "at rest" is read, should the page above it move.
        headingRest = heading.getBoundingClientRect().top + window.scrollY
      } else {
        // Sharp and whole until the bar collapses in, then it cross-fades
        // with the bar's title, never blurred (design review, Oct 2026): a
        // large title left half-faded on screen read as a blurred one (v4.6).
        heading.style.transition = `opacity ${TITLE_FADE_MS}ms ease-out`
        if (collapsed) heading.style.opacity = '0'
        else heading.style.removeProperty('opacity')
      }

      // The back link above the title slides under the status bar: it fades
      // on the way and is gone as the bar's chevron comes in.
      if (backLink) {
        faded.add(backLink)
        fadeTo(backLink, atTop ? 1 : 1 - scroll / collapseAt)
      }
      // The page's action hands over to the bar's as the title does, rather
      // than show cut under the bar beside its icon; the button's own
      // transition fades it.
      if (pageAction) {
        faded.add(pageAction)
        fadeTo(pageAction, collapsed ? 0 : 1)
      }

      // The subtitle fades with the scroll and is gone by the time its top
      // edge reaches the bar's divider, so no clipped glyphs show under it -
      // or by the time the bar collapses in, if it sits under the bar already.
      for (const { el, restTop } of subtitles) {
        fadeTo(el, 1 - scroll / Math.max(restTop - barBottom, collapseAt))
      }

      // A section label fades out before it reaches the divider.
      for (const el of document.querySelectorAll<HTMLElement>('main [data-bar-fade]')) {
        const opacity = collapsed ? (el.getBoundingClientRect().top - barBottom) / LABEL_FADE : 1
        if (opacity >= 1 && !faded.has(el)) continue
        faded.add(el)
        fadeTo(el, opacity)
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
      clear()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [pathname])

  const visible = shown && title !== null

  useEffect(() => {
    const root = document.documentElement
    // data-bar-shown turns the status strip to glass with the bar (globals.css).
    if (visible) {
      root.style.setProperty(STICKY_TOP_VAR, `calc(var(--safe-top) + ${BAR_HEIGHT}px)`)
      root.setAttribute('data-bar-shown', '')
    } else {
      root.style.removeProperty(STICKY_TOP_VAR)
      root.removeAttribute('data-bar-shown')
    }
    return () => {
      root.style.removeProperty(STICKY_TOP_VAR)
      root.removeAttribute('data-bar-shown')
    }
  }, [visible])

  const ActionIcon = action ? ACTION_ICONS[action] : undefined
  // The title, the chevron and the action come in together, over the
  // title's cross-fade.
  const fadeIn = 'animate-[fade-in_150ms_ease-out]'

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
        // It starts under the status strip and never touches the top edge
        // (v4.8): iOS 26 takes the topmost fixed element at the top as the
        // page's bar and kept the zone of this one (safe area + 44 pt) over
        // the large title after it hid again. Clear (owner, Oct 2026, after
        // Bevel): the glass behind it is the status strip's, grown down over
        // it and ending in a hairline.
        // It takes the taps that land on it, so none reach the page hidden
        // under it. Above the sticky tab strips (z-30), which move under it
        // while it shows.
        className={cn(
          'fixed inset-x-0 z-40 grid-cols-[56px_minmax(0,1fr)_56px] items-center lg:hidden',
          visible ? 'grid' : 'hidden',
        )}
        style={{
          top: 'var(--safe-top)',
          height: BAR_HEIGHT,
        }}
      >
        <span className="flex justify-center">
          {back !== null && (
            // The way back stays in reach once the page's own link has
            // scrolled away (design review, Oct 2026): 44 x 44 around a 24 pt
            // chevron, a glass circle as Bevel's buttons are (owner, Oct 2026).
            <button
              type="button"
              data-testid="compact-bar-back"
              aria-label={t.nav.backTo(back)}
              onClick={() => backRef.current?.click()}
              className={cn('glass-float flex size-11 items-center justify-center rounded-full text-foreground', fadeIn)}
            >
              <ChevronLeft size={24} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
        </span>
        {/* The page's own <h1> says it to a screen reader. */}
        <span aria-hidden="true" className={cn('block truncate text-center text-[17px] font-semibold leading-[52px] text-foreground', fadeIn)}>
          {title}
        </span>
        <span className="flex justify-center">
          {action === 'avatar' && (
            // Today's disc, as on the page: the accent with the initials.
            <button
              type="button"
              data-testid="compact-bar-action"
              aria-label={actionName}
              onClick={() => actionRef.current?.click()}
              className={cn('flex size-11 items-center justify-center rounded-full bg-accent text-base font-bold text-accent-foreground shadow-[0_8px_28px_rgb(0_0_0/0.18)]', fadeIn)}
            >
              <span aria-hidden="true">{actionText}</span>
            </button>
          )}
          {ActionIcon && (
            <button
              type="button"
              data-testid="compact-bar-action"
              aria-label={actionName}
              onClick={() => actionRef.current?.click()}
              className={cn('glass-float flex size-11 items-center justify-center rounded-full text-foreground', fadeIn)}
            >
              <ActionIcon size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
    </>
  )
}
