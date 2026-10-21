'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, RotateCw, Settings, Share, type LucideIcon } from 'lucide-react'
import { GlassLayers, GLASS_CIRCLE, glassClass } from '@/components/ui/GlassSurface'
import { fadeElement, unfadeElement } from '@/lib/glassFade'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

/**
 * iOS's large-title behaviour (v4.3.2): once the page has scrolled, the bar
 * under the status bar shows the page's title again as a centred 17 pt
 * title, instead of leaving it cut in half under the status bar. The bar has
 * no surface of its own; while it shows, the frosted material under it fades
 * in (data-bar-shown, .scroll-edge), cut by a hairline as Bevel's top (owner,
 * Oct 2026), and its title sits between glass buttons.
 *
 * Collapsed, it is 68 pt - the edge sampler's 12, a 46 pt row, then 10 pt of
 * material under the row before the hairline, as Bevel's - the title
 * centred, a 44 pt back chevron on a page reached from another, and the
 * page's actions and mirrored control at the trailing end.
 *
 * The bar draws nothing of its own. The title is the page's own <h1> (or
 * its `data-bar-title`, a shorter name where the whole one would crowd the
 * bar's controls, as Goals & season beside its year stepper), the way back
 * the page's BackButton (`data-bar-back`) and the action the control marked
 * `data-bar-action`, all read from the DOM: the chevron and
 * the action press the page's own controls, so they do just what those do.
 * A page with no <h1> never shows the bar.
 */
export const BAR_HEIGHT = 68

/** The room under the row, down to the hairline (owner, Oct 2026, as Bevel's). */
const BAR_FOOT = 10

/** The edge sampler's height (--edge-sample-h): the bar's first 12 pt sit under it. */
const SAMPLER = 12

/** A mirrored control comes into the bar this far before it reaches the bar's foot. */
const MIRROR_LEAD = 24

/** The property a stuck sticky strip's height is written to: the scroll edge grows by it. */
export const STICKY_H_VAR = '--sticky-h'

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
const ACTION_ICONS: Record<string, LucideIcon> = { share: Share, settings: Settings, refresh: RotateCw, add: Plus }

/**
 * A page's segmented control the bar mirrors (`data-bar-segments`: Activities'
 * List | Map, Analytics' 4W | 12W | 1Y, Plan's Week | Month; owner, Oct 2026),
 * once the control itself has scrolled under the bar.
 */
interface BarSegments {
  /**
   * `segments`: a toggle, each button a segment. `stepper` (Goals' ‹ 2026 ›,
   * data-bar-segments="stepper"): its first and last buttons the arrows,
   * the value the text between them.
   */
  kind: 'segments' | 'stepper'
  label: string
  items: { text: string; name: string; selected: boolean; disabled: boolean }[]
  /** The stepper's value: the text that is not a button. */
  value: string
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
 * Liquid Glass v2, section 11: the bar's controls are the page header's, at
 * the same 44 pt - glass circles 8 pt apart, a segmented control a 44 pt
 * capsule of 36 pt segments, Today's sync and avatar a 44 pt capsule as
 * Bevel's share and avatar (owner, Oct 2026) - 16 pt from each edge,
 * in the 46 pt row under the edge sampler, so a mirrored copy lands on the
 * original.
 */
const SIDE_PAD = 16
/** The bar title's widest, truncated past it (the brief's 150 pt). */
const TITLE_MAX = 150
/** The least room between the title and either side's controls. */
const TITLE_GAP = 8
/** A lead-aligned title's room after the back circle (round 2, F7). */
const TITLE_LEAD = 16

/** The bar's three columns, and whether the title is lead-aligned in the middle one. */
export interface TitleLayout {
  columns: string
  /** The title's left padding when lead-aligned; null when it is centred. */
  lead: number | null
}

/**
 * Where the title goes: centred on the screen when it fits between equal
 * sides, as a UINavigationBar places it. Where it doesn't (Analytics' 4W |
 * 12W | 1Y, Goals' ‹ 2026 ›), lead-aligned (round 2, F7) - at the page's
 * 16 pt margin, or 16 pt after the back circle - rather than floating
 * centred in the gap left, which read as off-centre.
 */
export function titleColumns(barWidth: number, left: number, right: number, title: number): TitleLayout {
  const side = Math.max(left, right)
  const fits = Math.min(title, TITLE_MAX) + 2 * TITLE_GAP <= barWidth - 2 * side
  if (fits) return { columns: `${side}px minmax(0,1fr) ${side}px`, lead: null }
  return { columns: `${left}px minmax(0,1fr) ${right}px`, lead: left > SIDE_PAD ? TITLE_LEAD : 0 }
}

/** The line under the large title that fades as it scrolls up: the <p> right
 *  after it, or one marked `data-title-sub` beside it or in its header. */
function subtitleOf(heading: HTMLElement): HTMLElement[] {
  const marked = [...((heading.closest('header') ?? heading.parentElement)?.querySelectorAll<HTMLElement>('[data-title-sub]') ?? [])]
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
// Glass-aware (Liquid Glass v3): a glass control fades its layers, never itself.
const fadeTo = fadeElement

/** An element as the page drew it, whatever the bar faded. */
const unfade = unfadeElement

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
        setTitle(current?.dataset.barTitle || current?.textContent?.trim() || null)
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
      // Mirrored as the control reaches the bar, before the soft edge blurs
      // it (Liquid Glass v2, round 2: 24 pt early), never beside it. A
      // control in the large title's header (List | Map, Week | Month,
      // 4W | 12W | 1Y) is the bar's from the moment the bar collapses in,
      // as the title is (round 3).
      const statusBarNow = probeRef.current?.offsetHeight ?? 0
      const inHeader = !!segmentsEl && !!current?.closest('header')?.contains(segmentsEl)
      const underBar = !!segmentsEl && (inHeader || segmentsEl.getBoundingClientRect().bottom <= statusBarNow + BAR_HEIGHT + MIRROR_LEAD)
      const stepper = segmentsEl?.dataset.barSegments === 'stepper'
      const readSegments: BarSegments | null = segmentsEl && underBar
        ? {
            kind: stepper ? 'stepper' : 'segments',
            label: segmentsEl.getAttribute('aria-label') ?? '',
            items: segmentButtons.map((b) => ({
              text: b.textContent?.trim() ?? '',
              name: nameOf(b),
              selected: b.getAttribute('aria-selected') === 'true' || b.getAttribute('aria-checked') === 'true',
              disabled: b.hasAttribute('disabled'),
            })),
            value: stepper ? (segmentsEl.querySelector<HTMLElement>('[data-bar-value]')?.textContent?.trim() ?? '') : '',
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
        : Math.max(SCROLL_TOP_TOLERANCE + 1, Math.min(COLLAPSE_SCROLL, headingRest - statusBar - SAMPLER))
      const collapsed = !atTop && scroll >= collapseAt
      setShown(collapsed)

      // The scroll edge grows by the sticky strip stuck under the bar (its
      // own height, whichever it is), so the rows dissolve under it too.
      const stuck = collapsed
        ? [...document.querySelectorAll<HTMLElement>('main [data-sticky-strip]')].find((el) => {
            const box = el.getBoundingClientRect()
            return box.top <= barBottom + 1 && box.bottom > barBottom
          })
        : undefined
      const stickyH = stuck ? `${stuck.offsetHeight}px` : ''
      if (document.documentElement.style.getPropertyValue(STICKY_H_VAR) !== stickyH) {
        if (stickyH) document.documentElement.style.setProperty(STICKY_H_VAR, stickyH)
        else document.documentElement.style.removeProperty(STICKY_H_VAR)
      }

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
      // A header control cross-fades with its copy in the bar, over the
      // title's fade, so the two are never seen at once (round 3).
      if (segmentsEl && inHeader) {
        faded.add(segmentsEl)
        segmentsEl.style.transition = `opacity ${TITLE_FADE_MS}ms ease-out`
        fadeTo(segmentsEl, collapsed ? 0 : 1)
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
    // Goals' year changes as text, not an attribute: characterData covers it.

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
    // data-bar-shown fades the soft scroll edge in (globals.css, .scroll-edge).
    if (visible) {
      root.style.setProperty(STICKY_TOP_VAR, `calc(var(--safe-top) + ${BAR_HEIGHT}px)`)
      root.setAttribute('data-bar-shown', '')
    } else {
      root.style.removeProperty(STICKY_TOP_VAR)
      root.style.removeProperty(STICKY_H_VAR)
      root.removeAttribute('data-bar-shown')
    }
  }, [visible])
  // Cleared on unmount only (F4): a cleanup on every change ran as the bar
  // collapsed in and took away the stuck strip's height the same frame had
  // just written, so the edge stopped at the bar until the next scroll.
  useEffect(() => () => {
    const root = document.documentElement
    root.style.removeProperty(STICKY_TOP_VAR)
    root.style.removeProperty(STICKY_H_VAR)
    root.removeAttribute('data-bar-shown')
  }, [])

  // The title, the chevron and the actions come in together, over the
  // title's cross-fade.
  const fadeIn = 'animate-[fade-in_150ms_ease-out]'
  // The title's columns, from what each side holds (titleColumns), measured
  // after every render, before paint, and on a resize.
  const barRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLSpanElement>(null)
  const rightRef = useRef<HTMLSpanElement>(null)
  const titleRef = useRef<HTMLSpanElement>(null)
  const [layout, setLayout] = useState<TitleLayout>({ columns: 'minmax(0,1fr) auto minmax(0,1fr)', lead: null })
  const layoutTitle = useCallback(() => {
    const barEl = barRef.current
    const titleEl = titleRef.current
    if (!barEl || !leftRef.current || !rightRef.current || !titleEl) return
    // The title's width as it is centred, whatever padding the current layout
    // gave it: measured with a lead-aligned title's 0 pt padding, a title 8 pt
    // too wide fitted, centred, no longer fitted, and the bar flipped between
    // the two on every render (React #185 on /activities).
    const style = getComputedStyle(titleEl)
    const text = titleEl.scrollWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    // Centred between the side insets (F15), which pad the bar in landscape.
    const bar = getComputedStyle(barEl)
    const inner = barEl.clientWidth - (parseFloat(bar.paddingLeft) || 0) - (parseFloat(bar.paddingRight) || 0)
    const next = titleColumns(
      inner,
      SIDE_PAD + leftRef.current.offsetWidth,
      SIDE_PAD + rightRef.current.offsetWidth,
      text + 2 * TITLE_GAP,
    )
    setLayout((prev) => (prev.columns === next.columns && prev.lead === next.lead ? prev : next))
  }, [])
  useLayoutEffect(layoutTitle)
  useEffect(() => {
    window.addEventListener('resize', layoutTitle)
    return () => window.removeEventListener('resize', layoutTitle)
  }, [layoutTitle])

  /** A stepper's arrow in the bar, pressing the page's own (button `i`). */
  const stepArrow = (stepper: BarSegments, i: number, Arrow: LucideIcon) => {
    const item = stepper.items[i]
    if (!item) return null
    return (
      <button
        type="button"
        aria-label={item.name}
        disabled={item.disabled}
        onClick={() => segmentsRef.current[i]?.click()}
        className="lg-press flex size-9 items-center justify-center rounded-full text-foreground disabled:opacity-35"
      >
        <Arrow size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    )
  }

  /**
   * One page action as the bar shows it, pressing the page's own control: a
   * 44 pt circle, or in Today's capsule the ↻ in its 44 pt and the 32 pt avatar.
   */
  const actionButton = (action: BarAction, i: number, inCapsule: boolean) => {
    const Icon = ACTION_ICONS[action.kind]
    return (
      <button
        key={action.kind + i}
        type="button"
        data-testid="compact-bar-action"
        aria-label={action.name}
        disabled={action.disabled}
        onClick={() => actionsRef.current[i]?.click()}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full disabled:opacity-60',
          // The avatar keeps its accent disc, as on the page.
          action.kind === 'avatar'
            ? cn('bg-accent font-bold text-accent-foreground', inCapsule ? 'hit-44 size-8 text-[13px]' : 'size-11 text-base shadow-[0_6px_20px_rgb(0_0_0/0.2)]')
            : cn('size-11 text-foreground', inCapsule ? 'lg-press' : glassClass('regular')),
          action.kind === 'avatar' && inCapsule && 'lg-press',
        )}
      >
        {action.kind !== 'avatar' && !inCapsule && <GlassLayers />}
        {action.kind === 'avatar' ? (
          <span aria-hidden="true">{action.text}</span>
        ) : Icon ? (
          <Icon size={20} strokeWidth={2} aria-hidden="true" className={cn(action.busy && 'animate-spin')} />
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
        ref={barRef}
        data-testid="compact-title-bar"
        data-shown={visible ? '' : undefined}
        // It starts under the status strip and never touches the top edge
        // (v4.8): iOS 26 takes the topmost fixed element at the top as the
        // page's bar and kept the zone of this one (safe area + 44 pt) over
        // the large title after it hid again. Liquid Glass v2 (owner's brief,
        // Oct 2026): no surface of its own - the soft scroll edge under it is
        // the bar (.scroll-edge), and only its glass buttons take taps; its
        // first 12 pt sit under the edge sampler. display: none when hidden,
        // never opacity, which WebKit still samples. Above the sticky tab
        // strips (z-30), which move under it while it shows.
        className={cn(
          'pointer-events-none fixed inset-x-0 z-40 items-center lg:hidden',
          visible ? 'grid' : 'hidden',
        )}
        style={{
          top: 'var(--safe-top)',
          height: BAR_HEIGHT,
          paddingTop: SAMPLER,
          paddingBottom: BAR_FOOT,
          // Clear of the notch and the corners in landscape (F15).
          paddingLeft: 'var(--safe-left)',
          paddingRight: 'var(--safe-right)',
          gridTemplateColumns: layout.columns,
        }}
      >
        <span className="flex justify-start" style={{ paddingLeft: SIDE_PAD }}>
          <span ref={leftRef} className="pointer-events-auto flex w-max">
            {back !== null && (
              // The way back stays in reach once the page's own link has
              // scrolled away (design review, Oct 2026): the page's 44 pt
              // glass chevron, as at rest (Liquid Glass v2).
              <button
                type="button"
                data-testid="compact-bar-back"
                aria-label={t.nav.backTo(back)}
                onClick={() => backRef.current?.click()}
                className={glassClass('regular', cn(GLASS_CIRCLE, 'lg-fade-in'))}
              >
                <GlassLayers />
                <ChevronLeft size={22} strokeWidth={2.2} aria-hidden="true" />
              </button>
            )}
          </span>
        </span>
        {/* The page's own <h1> says it to a screen reader. */}
        <span
          ref={titleRef}
          aria-hidden="true"
          data-align={layout.lead === null ? 'center' : 'lead'}
          className={cn('block truncate text-headline leading-[46px] text-foreground', layout.lead === null ? 'mx-auto text-center' : 'mr-auto text-left', fadeIn)}
          style={{ maxWidth: TITLE_MAX + (layout.lead ?? TITLE_GAP), paddingLeft: layout.lead ?? TITLE_GAP, paddingRight: TITLE_GAP }}
        >
          {title}
        </span>
        <span className="flex justify-end" style={{ paddingRight: SIDE_PAD }}>
          <span ref={rightRef} className="pointer-events-auto flex w-max items-center gap-2">
            {segments?.kind === 'segments' && (
              // The page's segmented control, in glass: the chosen one on the
              // tab bar's pill. A tap presses the page's own segment.
              <span role="group" aria-label={segments.label} data-testid="compact-bar-segments" className={glassClass('regular', 'lg-fade-in flex h-11 shrink-0 items-center p-1')}>
                <GlassLayers />
                {segments.items.map((item, i) => (
                  <button
                    key={item.text + i}
                    type="button"
                    aria-label={item.name}
                    aria-pressed={item.selected}
                    onClick={() => segmentsRef.current[i]?.click()}
                    className={cn(
                      // 36 pt in the capsule's 4 pt of glass: 44 pt, as at rest.
                      'lg-press flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-[15px] text-foreground transition-colors',
                      item.selected ? 'bg-[var(--tab-pill)] font-semibold' : 'font-medium',
                    )}
                  >
                    {item.text}
                  </button>
                ))}
              </span>
            )}
            {segments?.kind === 'stepper' && (
              // Goals' ‹ 2026 ›, in one glass capsule: the arrows press the
              // page's own, the year between them.
              <span role="group" aria-label={segments.label} data-testid="compact-bar-segments" className={glassClass('regular', 'lg-fade-in flex h-11 shrink-0 items-center gap-0.5 p-1')}>
                <GlassLayers />
                {stepArrow(segments, 0, ChevronLeft)}
                <span aria-live="polite" className="min-w-[4ch] px-1 text-center text-sm font-semibold tabular-nums text-foreground">
                  {segments.value}
                </span>
                {stepArrow(segments, segments.items.length - 1, ChevronRight)}
              </span>
            )}
            {actions.length === 1 && <span className={cn('flex', fadeIn)}>{actionButton(actions[0]!, 0, false)}</span>}
            {actions.length > 1 && (
              // Two in one glass capsule, as on the page (owner, Oct 2026,
              // as Claude's and Bevel's tops pair theirs).
              <span data-testid="compact-bar-capsule" className={glassClass('regular', 'lg-fade-in flex h-11 items-center gap-1 pr-1.5')}>
                <GlassLayers />
                {actions.map((action, i) => actionButton(action, i, true))}
              </span>
            )}
          </span>
        </span>
      </div>
    </>
  )
}
