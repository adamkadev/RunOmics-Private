'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronLeft, RotateCw, Settings, Share, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

/**
 * iOS's large-title behaviour (v4.3.2): once the page has scrolled, the bar
 * under the status bar shows the page's title again as a centred 17 pt
 * title, instead of leaving it cut in half under the status bar. While it
 * shows it is frosted glass ending in a hairline, as Bevel's top is, and the
 * status strip above it turns to the same glass (globals.css, .top-glass,
 * data-bar-shown; owner, Oct 2026). Its title sits between glass buttons.
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
 * activity's Share, Progress' Settings gear and Today's sync. `avatar`
 * (Today's link to Progress) shows the page's own initials instead. A page
 * with two (Today: sync and avatar) gets them in one glass capsule, as
 * Bevel's share and avatar (owner, Oct 2026).
 */
const ACTION_ICONS: Record<string, LucideIcon> = { share: Share, settings: Settings, refresh: RotateCw }

/**
 * A page's segmented control the bar mirrors (`data-bar-segments`: Activities'
 * List | Map, Analytics' 4W | 12W | 1Y, Plan's Week | Month; owner, Oct 2026),
 * once the control itself has scrolled under the bar.
 */
interface BarSegments {
  label: string
  items: { text: string; name: string; selected: boolean }[]
}

/** A page control the bar mirrors, as it reads it from the DOM. */
interface BarAction {
  kind: string
  name: string
  /** What the control says: the avatar's initials. */
  text: string
  /** `data-bar-busy` on the control: the sync running, its arrows turning. */
  busy: boolean
  disabled: boolean
}

/**
 * The bar's controls are 40 pt tall (owner, Oct 2026, after Claude's and
 * Bevel's tops): a circle, or a capsule of two 32 pt buttons, 4 pt apart in
 * 4 pt of glass, each 12 pt from the edge; 44 pt tap areas (hit-44). The
 * row's centre sits ROW_LIFT above the bar's, so they clear its hairline by
 * about 9 pt rather than touching it.
 */
const SIDE = 56
const CAPSULE_SIDE = 88
const ROW_LIFT = 6

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
  const actionsRef = useRef<HTMLElement[]>([])
  const segmentsRef = useRef<HTMLElement[]>([])
  const [segments, setSegments] = useState<BarSegments | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const [back, setBack] = useState<string | null>(null)
  const [actions, setActions] = useState<BarAction[]>([])

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
      const pageActions = [...document.querySelectorAll<HTMLElement>('main [data-bar-action]')]
      backRef.current = backLink
      actionsRef.current = pageActions
      setBack(backLink ? nameOf(backLink) : null)
      const read = pageActions.map((el) => ({
        kind: el.dataset.barAction ?? '',
        name: nameOf(el),
        text: el.textContent?.trim() ?? '',
        busy: el.hasAttribute('data-bar-busy'),
        disabled: el.hasAttribute('disabled'),
      }))
      // Only a change re-renders: this runs on every scroll frame.
      setActions((prev) => (JSON.stringify(prev) === JSON.stringify(read) ? prev : read))
      const segmentsEl = document.querySelector<HTMLElement>('main [data-bar-segments]')
      const segmentButtons = segmentsEl ? [...segmentsEl.querySelectorAll<HTMLElement>('button')] : []
      segmentsRef.current = segmentButtons
      // Mirrored once the control has gone under the bar, never beside it.
      const statusBarNow = probeRef.current?.offsetHeight ?? 0
      const underBar = !!segmentsEl && segmentsEl.getBoundingClientRect().bottom <= statusBarNow + BAR_HEIGHT + 4
      const readSegments: BarSegments | null = segmentsEl && underBar
        ? {
            label: segmentsEl.getAttribute('aria-label') ?? '',
            items: segmentButtons.map((b) => ({
              text: b.textContent?.trim() ?? '',
              name: nameOf(b),
              selected: b.getAttribute('aria-selected') === 'true' || b.getAttribute('aria-checked') === 'true',
            })),
          }
        : null
      setSegments((prev) => (JSON.stringify(prev) === JSON.stringify(readSegments) ? prev : readSegments))
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
      // The page's actions hand over to the bar's as the title does, rather
      // than show cut under the bar beside their icons; the buttons' own
      // transitions fade them.
      for (const el of pageActions) {
        faded.add(el)
        fadeTo(el, collapsed ? 0 : 1)
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
    // The sync's busy and disabled states are attributes on its button.
    if (main) observer!.observe(main, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-bar-busy', 'disabled', 'aria-selected', 'aria-checked'] })

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

  // The title, the chevron and the actions come in together, over the
  // title's cross-fade.
  const fadeIn = 'animate-[fade-in_150ms_ease-out]'
  // Both sides as wide, so the title stays centred: a capsule of two needs
  // more than one circle's 56 pt.
  const side = actions.length > 1 ? CAPSULE_SIDE : SIDE

  /** One page action as the bar shows it, pressing the page's own control. */
  const actionButton = (action: BarAction, i: number, inCapsule: boolean) => {
    const Icon = ACTION_ICONS[action.kind]
    const size = inCapsule ? 'size-8' : 'size-10'
    return (
      <button
        key={action.kind + i}
        type="button"
        data-testid="compact-bar-action"
        aria-label={action.name}
        disabled={action.disabled}
        onClick={() => actionsRef.current[i]?.click()}
        className={cn(
          'hit-44 flex shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-60',
          size,
          action.kind === 'avatar'
            ? cn('bg-accent font-bold text-accent-foreground', inCapsule ? 'text-sm' : 'text-base')
            : cn('text-foreground', !inCapsule && 'glass-float'),
          action.kind === 'avatar' && !inCapsule && 'shadow-[0_8px_28px_rgb(0_0_0/0.18)]',
        )}
      >
        {action.kind === 'avatar' ? (
          <span aria-hidden="true">{action.text}</span>
        ) : Icon ? (
          <Icon size={inCapsule ? 18 : 20} strokeWidth={2} aria-hidden="true" className={cn(action.busy && 'animate-spin')} />
        ) : null}
      </button>
    )
  }

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
        // the large title after it hid again. Frosted glass ending in a
        // hairline (.top-glass, owner, Oct 2026, after Bevel).
        // It takes the taps that land on it, so none reach the page hidden
        // under it. Above the sticky tab strips (z-30), which move under it
        // while it shows.
        className={cn(
          'top-glass fixed inset-x-0 z-40 items-center lg:hidden',
          visible ? 'grid' : 'hidden',
        )}
        style={{
          top: 'var(--safe-top)',
          height: BAR_HEIGHT,
          paddingBottom: ROW_LIFT,
          // With a mirrored control the sides share what the title leaves,
          // equally, so it stays centred whatever the control's width.
          gridTemplateColumns: segments ? 'minmax(0,1fr) auto minmax(0,1fr)' : `${side}px minmax(0,1fr) ${side}px`,
        }}
      >
        <span className="flex justify-start pl-3">
          {back !== null && (
            // The way back stays in reach once the page's own link has
            // scrolled away (design review, Oct 2026): 44 x 44 around a 24 pt
            // chevron, a glass circle as Bevel's buttons are (owner, Oct 2026).
            <button
              type="button"
              data-testid="compact-bar-back"
              aria-label={t.nav.backTo(back)}
              onClick={() => backRef.current?.click()}
              className={cn('hit-44 glass-float flex size-10 items-center justify-center rounded-full text-foreground', fadeIn)}
            >
              <ChevronLeft size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
        </span>
        {/* The page's own <h1> says it to a screen reader. */}
        <span aria-hidden="true" className={cn('block truncate text-center text-[17px] font-semibold leading-[46px] text-foreground', fadeIn)}>
          {title}
        </span>
        <span className="flex items-center justify-end gap-2 pr-3">
          {segments && (
            // The page's segmented control, in glass: the chosen one on the
            // tab bar's pill. A tap presses the page's own segment.
            <span role="group" aria-label={segments.label} data-testid="compact-bar-segments" className={cn('glass-float flex shrink-0 items-center gap-0.5 rounded-full p-1', fadeIn)}>
              {segments.items.map((item, i) => (
                <button
                  key={item.text + i}
                  type="button"
                  aria-label={item.name}
                  aria-pressed={item.selected}
                  onClick={() => segmentsRef.current[i]?.click()}
                  className={cn(
                    'flex h-8 items-center whitespace-nowrap rounded-full px-2.5 text-xs transition-colors',
                    // 32 pt in the capsule's 4 pt of glass: 40 pt, as the circles.
                    item.selected ? 'bg-[var(--tab-pill)] font-semibold text-foreground' : 'font-medium text-muted-foreground',
                  )}
                >
                  {item.text}
                </button>
              ))}
            </span>
          )}
          {actions.length === 1 && <span className={cn('flex', fadeIn)}>{actionButton(actions[0]!, 0, false)}</span>}
          {actions.length > 1 && (
            // Two or more in one glass capsule, as Bevel's share and avatar.
            <span data-testid="compact-bar-capsule" className={cn('glass-float flex items-center gap-1 rounded-full p-1', fadeIn)}>
              {actions.map((action, i) => actionButton(action, i, true))}
            </span>
          )}
        </span>
      </div>
    </>
  )
}
