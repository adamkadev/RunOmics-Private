'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, RotateCw, Settings, Share, type LucideIcon } from 'lucide-react'
import { GlassLayers, GLASS_CIRCLE, glassClass } from '@/components/ui/GlassSurface'
import { fadeElement, unfadeElement } from '@/lib/glassFade'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

/**
 * The bar draws nothing of its own: its title is the page's <h1> (or its `data-bar-title`), its way back
 * `data-bar-back` and its actions `data-bar-action`, all read from the DOM, and its buttons press the
 * page's own controls, so they do just what those do. A page with no <h1> never shows the bar.
 *
 * 68 pt: the edge sampler's 12, a 46 pt row, then 10 pt of material before the hairline.
 */
export const BAR_HEIGHT = 68

/** The room under the row, down to the hairline. */
const BAR_FOOT = 10

/** The edge sampler's height (--edge-sample-h). */
const SAMPLER = 12

/** A mirrored control comes into the bar this far before it reaches the bar's foot. */
const MIRROR_LEAD = 24

/** A stuck sticky strip's height, which the scroll edge grows by. */
export const STICKY_H_VAR = '--sticky-h'

/** Past the back link, which is about this tall with its margin. */
export const COLLAPSE_SCROLL = 24

export const TITLE_FADE_MS = 150

/** Where a sticky strip sits while the bar shows; unset, each strip keeps its own. */
export const STICKY_TOP_VAR = '--sticky-top'

/** Set on the edge, its only reader: on <html> every change restyled the whole page, 60-90 ms a time on a long list. */
const scrollEdge = () => document.querySelector<HTMLElement>('.scroll-edge')

/** A tab swap can leave a page 1-2 pt down, which is still its top. */
export const SCROLL_TOP_TOLERANCE = 2

/** About a section label's (`data-bar-fade`) own line, so no cut caps show under the bar's divider. */
const LABEL_FADE = 16

/** Matches lg:hidden: a wide screen keeps the page's header. */
const WIDE = '(min-width: 64rem)'

/** `avatar` is not here: it shows the page's own initials. */
const ACTION_ICONS: Record<string, LucideIcon> = { share: Share, settings: Settings, refresh: RotateCw, add: Plus }

interface BarSegments {
  /** `stepper`: the first and last buttons are the arrows, the value the text between them. */
  kind: 'segments' | 'stepper'
  label: string
  items: { text: string; name: string; selected: boolean; disabled: boolean }[]
  value: string
}

interface BarAction {
  kind: string
  name: string
  /** The avatar's initials. */
  text: string
  /** `data-bar-busy`: the sync running, its arrows turning. */
  busy: boolean
  disabled: boolean
}

/** As the page header's controls, so a mirrored copy lands on the original. */
const SIDE_PAD = 16
const TITLE_MAX = 150
/** The least room between the title and either side's controls. */
const TITLE_GAP = 8
/** A lead-aligned title's room after the back circle. */
const TITLE_LEAD = 16

export interface TitleLayout {
  columns: string
  /** The title's left padding when lead-aligned; null when it is centred. */
  lead: number | null
}

/**
 * Centred on the screen when it fits between equal sides, as a UINavigationBar places it; otherwise
 * lead-aligned rather than floating centred in the gap left, which reads as off-centre.
 */
export function titleColumns(barWidth: number, left: number, right: number, title: number): TitleLayout {
  const side = Math.max(left, right)
  const fits = Math.min(title, TITLE_MAX) + 2 * TITLE_GAP <= barWidth - 2 * side
  if (fits) return { columns: `${side}px minmax(0,1fr) ${side}px`, lead: null }
  return { columns: `${left}px minmax(0,1fr) ${right}px`, lead: left > SIDE_PAD ? TITLE_LEAD : 0 }
}

function subtitleOf(heading: HTMLElement): HTMLElement[] {
  const marked = [...((heading.closest('header') ?? heading.parentElement)?.querySelectorAll<HTMLElement>('[data-title-sub]') ?? [])]
  const next = heading.nextElementSibling
  return next instanceof HTMLElement && next.tagName === 'P' && !marked.includes(next) ? [next, ...marked] : marked
}

function nameOf(el: HTMLElement): string {
  return el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''
}

// A glass control fades its layers, never itself.
const fadeTo = fadeElement

const unfade = unfadeElement

/** No inline style at all, not even opacity 1, so nothing keeps the title on a layer of its own. */
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
    // Set by a change in <main> or a resize: the page's elements are looked up again on the next frame, not every one.
    let stale = true
    let heading: HTMLElement | null = null
    // The large title's top edge at rest, in page coordinates.
    let headingRest = 0
    // Each subtitle line with its top edge at rest, in page coordinates.
    let subtitles: { el: HTMLElement; restTop: number }[] = []
    const faded = new Set<HTMLElement>()
    let backLink: HTMLElement | null = null
    let pageActions: HTMLElement[] = []
    let segmentsEl: HTMLElement | null = null
    let inHeader = false
    let segmentsRead: BarSegments | null = null
    let strips: HTMLElement[] = []
    let labels: HTMLElement[] = []
    let edge: HTMLElement | null = null
    let statusBar = 0
    // What React last got, so a scroll frame that changes nothing renders nothing.
    let lastShown: boolean | null = null
    let lastSegments: BarSegments | null | undefined
    const wideQuery = window.matchMedia(WIDE)
    let wide = wideQuery.matches

    const show = (next: boolean) => {
      if (next === lastShown) return
      lastShown = next
      setShown(next)
    }

    const clear = () => {
      if (heading) restTitle(heading)
      for (const { el } of subtitles) unfade(el)
      for (const el of faded) unfade(el)
      faded.clear()
    }

    const refresh = () => {
      stale = false
      const current = document.querySelector<HTMLElement>('main h1')
      if (current !== heading) {
        const rest = current ? current.getBoundingClientRect().top + window.scrollY : 0
        const lines = current ? subtitleOf(current).map((el) => ({ el, restTop: el.getBoundingClientRect().top + window.scrollY })) : []
        clear()
        heading = current
        headingRest = rest
        subtitles = lines
        setTitle(current?.dataset.barTitle || current?.textContent?.trim() || null)
      }
      backLink = document.querySelector<HTMLElement>('main [data-bar-back]')
      pageActions = [...document.querySelectorAll<HTMLElement>('main [data-bar-action]')]
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
      setActions((prev) => (JSON.stringify(prev) === JSON.stringify(read) ? prev : read))
      segmentsEl = document.querySelector<HTMLElement>('main [data-bar-segments]')
      const segmentButtons = segmentsEl ? [...segmentsEl.querySelectorAll<HTMLElement>('button')] : []
      segmentsRef.current = segmentButtons
      inHeader = !!segmentsEl && !!heading?.closest('header')?.contains(segmentsEl)
      const stepper = segmentsEl?.dataset.barSegments === 'stepper'
      segmentsRead = segmentsEl
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
      strips = [...document.querySelectorAll<HTMLElement>('main [data-sticky-strip]')]
      labels = [...document.querySelectorAll<HTMLElement>('main [data-bar-fade]')]
      edge = scrollEdge()
      statusBar = probeRef.current?.offsetHeight ?? 0
    }

    // Every read before the first write: a read after a style write makes WebKit lay the page out again, mid-frame.
    const measure = () => {
      frame = 0
      if (stale) refresh()
      const scroll = window.scrollY
      const barBottom = statusBar + BAR_HEIGHT
      // Mirrored before the soft edge blurs the control, never beside it; a control in the large title's
      // header is the bar's from the moment the bar collapses in, as the title is.
      const underBar = !!segmentsEl && (inHeader || segmentsEl.getBoundingClientRect().bottom <= barBottom + MIRROR_LEAD)
      const mirrored = underBar ? segmentsRead : null
      if (mirrored !== lastSegments) {
        lastSegments = mirrored
        setSegments((prev) => (JSON.stringify(prev) === JSON.stringify(mirrored) ? prev : mirrored))
      }
      if (!heading || wide) {
        clear()
        show(false)
        return
      }

      const atTop = scroll <= SCROLL_TOP_TOLERANCE
      // Sooner where the large title meets the status bar first. A title under a hero (`data-title-late`,
      // the activity's map) is on screen well past 24 pt, so the bar waits until the title reaches it.
      const collapseAt = heading.hasAttribute('data-title-late')
        ? Math.max(SCROLL_TOP_TOLERANCE + 1, headingRest - barBottom)
        : Math.max(SCROLL_TOP_TOLERANCE + 1, Math.min(COLLAPSE_SCROLL, headingRest - statusBar - SAMPLER))
      const collapsed = !atTop && scroll >= collapseAt
      // At rest is where "at rest" is read, should the page above it move.
      const restNow = atTop ? heading.getBoundingClientRect().top + scroll : headingRest
      // The scroll edge grows by the sticky strip stuck under the bar (its
      // own height, whichever it is), so the rows dissolve under it too.
      const stuck = collapsed
        ? strips.find((el) => {
            const box = el.getBoundingClientRect()
            return box.top <= barBottom + 1 && box.bottom > barBottom
          })
        : undefined
      const stickyH = stuck ? `${stuck.offsetHeight}px` : ''
      const labelOpacity = labels.map((el) => (collapsed ? (el.getBoundingClientRect().top - barBottom) / LABEL_FADE : 1))

      show(collapsed)
      if (edge && edge.style.getPropertyValue(STICKY_H_VAR) !== stickyH) {
        if (stickyH) edge.style.setProperty(STICKY_H_VAR, stickyH)
        else edge.style.removeProperty(STICKY_H_VAR)
      }

      if (atTop) {
        restTitle(heading)
        headingRest = restNow
      } else {
        // Whole until the bar collapses in, then a cross-fade: a large title left half-faded reads as blurred.
        heading.style.transition = `opacity ${TITLE_FADE_MS}ms ease-out`
        if (collapsed) heading.style.opacity = '0'
        else heading.style.removeProperty('opacity')
      }

      // Gone as the bar's chevron comes in.
      if (backLink) {
        faded.add(backLink)
        fadeTo(backLink, atTop ? 1 : 1 - scroll / collapseAt)
      }
      // Handed over as the title is, rather than shown cut under the bar beside their icons.
      for (const el of pageActions) {
        faded.add(el)
        fadeTo(el, collapsed ? 0 : 1)
      }
      // Over the title's fade, so a header control and its copy in the bar are never seen at once.
      // At rest no inline style, as the title: written before the page hydrates, it would not match the server's HTML.
      if (segmentsEl && inHeader) {
        faded.add(segmentsEl)
        if (atTop) unfade(segmentsEl)
        else {
          segmentsEl.style.transition = `opacity ${TITLE_FADE_MS}ms ease-out`
          fadeTo(segmentsEl, collapsed ? 0 : 1)
        }
      }

      // The subtitle fades with the scroll and is gone by the time its top
      // edge reaches the bar's divider, so no clipped glyphs show under it -
      // or by the time the bar collapses in, if it sits under the bar already.
      for (const { el, restTop } of subtitles) {
        fadeTo(el, 1 - scroll / Math.max(restTop - barBottom, collapseAt))
      }

      labels.forEach((el, i) => {
        const opacity = labelOpacity[i]!
        if (opacity >= 1 && !faded.has(el)) return
        faded.add(el)
        fadeTo(el, opacity)
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    const restale = () => {
      stale = true
      schedule()
    }
    wideQuery.onchange = (event) => {
      wide = event.matches
      schedule()
    }

    // A client page swaps its content (a tab, a loaded list) without a route
    // change, so the heading is looked up again whenever <main> changes.
    const main = document.querySelector('main')
    const observer = main ? new MutationObserver(restale) : null
    // The sync's busy and disabled states are attributes on its button; the rest are what the bar finds or reads.
    if (main) {
      observer!.observe(main, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          'data-bar-busy',
          'disabled',
          'aria-selected',
          'aria-checked',
          'aria-label',
          'data-bar-back',
          'data-bar-action',
          'data-bar-segments',
          'data-sticky-strip',
          'data-bar-fade',
        ],
      })
    }
    // Goals' year changes as text, not an attribute: characterData covers it.

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', restale)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer?.disconnect()
      wideQuery.onchange = null
      clear()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', restale)
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
      scrollEdge()?.style.removeProperty(STICKY_H_VAR)
      root.removeAttribute('data-bar-shown')
    }
  }, [visible])
  // Cleared on unmount only: a cleanup on every change would run as the bar collapses in and take away
  // the stuck strip's height that same frame just wrote.
  useEffect(() => () => {
    const root = document.documentElement
    root.style.removeProperty(STICKY_TOP_VAR)
    scrollEdge()?.style.removeProperty(STICKY_H_VAR)
    root.removeAttribute('data-bar-shown')
  }, [])

  // Over the title's cross-fade.
  const fadeIn = 'animate-[fade-in_150ms_ease-out]'
  const barRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLSpanElement>(null)
  const rightRef = useRef<HTMLSpanElement>(null)
  const titleRef = useRef<HTMLSpanElement>(null)
  const [layout, setLayout] = useState<TitleLayout>({ columns: 'minmax(0,1fr) auto minmax(0,1fr)', lead: null })
  const layoutTitle = useCallback(() => {
    const barEl = barRef.current
    const titleEl = titleRef.current
    if (!barEl || !leftRef.current || !rightRef.current || !titleEl) return
    // Measured without the current layout's padding, or a title near the limit flips between centred
    // and lead-aligned on every render.
    const style = getComputedStyle(titleEl)
    const text = titleEl.scrollWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const next = titleColumns(
      barEl.clientWidth,
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
        // Never touches the top edge: iOS 26 takes the topmost fixed element there as the page's bar and
        // keeps its zone over the large title after it hides. display: none when hidden, never opacity,
        // which WebKit still samples. Above the sticky tab strips (z-30), which move under it.
        className={cn(
          'pointer-events-none fixed inset-x-0 z-40 items-center lg:hidden',
          visible ? 'grid' : 'hidden',
        )}
        style={{
          top: 'var(--safe-top)',
          height: BAR_HEIGHT,
          paddingTop: SAMPLER,
          paddingBottom: BAR_FOOT,
          gridTemplateColumns: layout.columns,
        }}
      >
        <span className="flex justify-start" style={{ paddingLeft: SIDE_PAD }}>
          <span ref={leftRef} className="pointer-events-auto flex w-max">
            {back !== null && (
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
