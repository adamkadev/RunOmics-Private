'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { GlassLayers } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/formatters'
import { linePath } from '@/lib/linePath'
import type { DeltaTone } from '@/lib/deltaTone'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import type { StatTone } from '@/components/ui/Stat'
import { t } from '@/i18n'

/**
 * The v4.5 card recipe (D1-D4): a title with its source or unit on the right,
 * then the number, one sentence, the chart and its legend. The (i) icons are
 * gone; the title itself opens the card's explanation. The card itself is the
 * app's one (v4.17): radius 16, a line border, the surface, 18 x 20 padding.
 */
export function Card({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <section data-testid={testId} className={cardClass({ className: cn('flex flex-col gap-3', className) })}>
      {children}
    </section>
  )
}

/**
 * A card title: 15 px at 600, with its caption 13 px muted. One rule for the
 * caption (L5): on the title's line, at the right, only while the whole of
 * it fits there; otherwise on its own line under the title, from the left -
 * never a right-aligned caption wrapped under the title, as Temperature
 * cost's was. No measuring: in a wrapping row the caption moves down when
 * its one-line width does not fit beside the title, and alone on its line
 * `justify-between` puts it at the start.
 */
export function CardHead({ title, caption, about, right }: { title: string; caption?: ReactNode; about?: string; right?: ReactNode }) {
  const [open, setOpen] = useState(false)
  // Never truncated: « Coût de la chaleur » lost half its width on a phone.
  // The title keeps its words whole and the caption moves under it when the
  // two do not fit one line - squeezed beside a long caption, the title broke
  // letter by letter.
  const titleClass = 'min-w-0 text-pretty text-left text-[15px] font-semibold leading-snug text-foreground'
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" data-card-head>
      {about ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={cn(titleClass, 'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
        >
          {title}
        </button>
      ) : (
        <h2 className={titleClass}>{title}</h2>
      )}
      {right ?? (caption && <span data-card-caption className="min-w-0 text-left text-[13px] leading-[18px] text-pretty text-muted-foreground">{caption}</span>)}
      {open && about && (
        <Dialog title={title} onClose={() => setOpen(false)}>
          <p className="text-sm leading-normal text-[var(--text-2)]">{about}</p>
        </Dialog>
      )}
    </div>
  )
}

/** One sentence, 14 pt body in text-2, its key figure in bold text ink. */
export function Sentence({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <p data-testid={testId} className={cn('text-sm leading-normal text-[var(--text-2)] text-pretty [&_b]:font-semibold [&_b]:text-foreground', className)}>
      {children}
    </p>
  )
}

/**
 * A card's one number (v4.17 stat value): 26 px at 600, its unit inline at
 * 13 px muted, and a note beside it - 12 px, muted unless it says something.
 */
export function Headline({ value, unit, note, noteStyle, valueStyle, testId }: { value: ReactNode; unit?: ReactNode; note?: ReactNode; noteStyle?: CSSProperties; valueStyle?: CSSProperties; testId?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-foreground" style={valueStyle} data-testid={testId}>
        {value}
        {unit != null && <span className="ml-1 text-[13px] font-normal tracking-normal text-muted-foreground">{unit}</span>}
      </span>
      {note && (
        <span className="text-xs text-muted-foreground" style={noteStyle}>
          {note}
        </span>
      )}
    </div>
  )
}

/** A delta's meaning as a stat tone: good news pos, worse warn, noise muted. */
export const STAT_TONE: Record<DeltaTone, StatTone> = { good: 'pos', worse: 'warn', flat: 'muted' }

// The legend is the app's one recipe (v4.17), shared with every page.
export { Legend, LegendItem } from '@/components/ui/Legend'

/** Start, middle and end of a window, the end read as Today while it is. */
export function windowLabels(dates: string[], live: boolean): string[] {
  if (!dates.length) return []
  const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })
  const mid = dates[Math.floor((dates.length - 1) / 2)]!
  return [bare(dates[0]!), bare(mid), live ? t.analytics.cards.today : bare(dates[dates.length - 1]!)]
}

/** A row's trend line, 24 pt tall and muted; `lowerUp` for a time, where faster is a smaller number. */
export function Spark({ values, lowerUp = false }: { values: number[]; lowerUp?: boolean }) {
  if (values.length < 2) return <span />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min) * 0.3 || 1
  const d = lowerUp ? linePath(values.map((v) => -v), -(max + pad), -(min - pad), 1000, 24) : linePath(values, min - pad, max + pad, 1000, 24)
  return (
    <svg width="100%" height="24" viewBox="0 0 1000 24" preserveAspectRatio="none" className="block" aria-hidden data-testid="spark">
      <path d={d} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Axis labels under a chart, spread end to end: 11 px muted. */
export function AxisLabels({ labels, className }: { labels: string[]; className?: string }) {
  return (
    <div className={cn('flex justify-between text-caption leading-none text-muted-foreground', className)} aria-hidden>
      {labels.map((label, i) => (
        <span key={i}>{label}</span>
      ))}
    </div>
  )
}

/**
 * The page's one period control (v4.17), right of the title: a header
 * toggle in glass, as SegmentedTabs' barMirror recipe (Liquid Glass v2,
 * section 11) - 36 pt segments in a 44 pt capsule, the chosen one on the tab
 * bar's pill. It stays a radiogroup: a period filters the tab under it, it
 * is not a tab of its own.
 */
export function PeriodControl<P extends string>({ periods, value, onChange }: { periods: readonly P[]; value: P; onChange: (p: P) => void }) {
  const s = t.analytics.cards.period
  return (
    // data-bar-segments: the compact top bar carries it once it scrolls away.
    <div role="radiogroup" aria-label={s.label} data-bar-segments className="lg flex h-11 shrink-0 p-1">
      <GlassLayers />
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={p === value}
          // "4W" on screen, "4 weeks" read aloud (3.1.0).
          aria-label={s.words[p]}
          onClick={() => onChange(p)}
          className={cn(
            'lg-press hit-44 flex h-9 items-center justify-center whitespace-nowrap rounded-full px-3.5 text-[15px] text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            p === value ? 'bg-[var(--tab-pill)] font-semibold' : 'font-medium',
          )}
        >
          {s.short[p]}
        </button>
      ))}
    </div>
  )
}

const DIALOG_TONE: Record<StatTone, string> = {
  pos: 'var(--pos)',
  warn: 'var(--warn)',
  neg: 'var(--neg)',
  muted: 'var(--muted-foreground)',
}

/**
 * The page's one dialog (v4.17): a centred modal, 520 wide at most, radius
 * 18, over a 55% scrim blurred 2 px - no bottom-sheet handle. An eyebrow and
 * a 19 px title with a close button, the body, then its actions on the right
 * (Close alone unless it has its own). Focus stays inside, Escape closes it
 * and the page under it does not scroll.
 */
export function Dialog({
  title,
  eyebrow,
  eyebrowTone = 'muted',
  onClose,
  actions,
  children,
}: {
  title: string
  eyebrow?: string
  eyebrowTone?: StatTone
  onClose: () => void
  /** The dialog's buttons, the primary one last; none, and it has no footer. */
  actions?: ReactNode
  children: ReactNode
}) {
  const trapRef = useFocusTrap<HTMLDivElement>()
  const titleId = useId()
  useScrollLock()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Under the status bar, as every sheet: the strip dims itself (useScrollLock).
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 flex items-center justify-center p-4 sm:p-6" style={{ touchAction: 'none' }}>
      <div className="absolute inset-0 animate-fade-in bg-[var(--scrim-sheet)]" onClick={onClose} aria-hidden />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-full w-full max-w-[520px] animate-fade-up flex-col gap-3.5 overflow-y-auto overscroll-contain rounded-[28px] bg-[var(--raised)] px-[22px] py-[22px] shadow-[var(--shadow-modal)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            {eyebrow && (
              <span className={EYEBROW_CLASS} style={{ color: DIALOG_TONE[eyebrowTone] }}>
                {eyebrow}
              </span>
            )}
            <h2 id={titleId} className="text-title-3 text-foreground text-pretty">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.analytics.cards.close}
            className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--fill-3)] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={20} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        {children}
        {/* One way to dismiss (design review, Oct 2026): the × above, the
            backdrop and Escape. A second "Close" beside it said the same. */}
        {actions && <div className="flex justify-end gap-2">{actions}</div>}
      </div>
    </div>,
    document.body,
  )
}

const HOLD_MS = 250
const MOVE_TOLERANCE_PX = 8
const SWIPE_PX = 56

/**
 * Press and hold on a chart for a hairline and a value chip; let go and it
 * goes. A horizontal swipe instead moves the tab's window back or forward in
 * time (v4.5): the charts are the only place history is browsed now that the
 * cards' own date arrows are gone. A mouse gets the readout on hover.
 */
export function ChartScrub({
  count,
  mode = 'bar',
  readout,
  onShift,
  onActive,
  positions,
  children,
  className,
}: {
  count: number
  /** Bars sit in slots; a line's points sit on the ends. */
  mode?: 'bar' | 'line'
  readout: (index: number) => ReactNode
  /** +1 is one window older, -1 one newer. */
  onShift?: (step: 1 | -1) => void
  /** The slot under the finger, null once it lifts: a card's legend can follow it. */
  onActive?: (index: number | null) => void
  /** A line's points at these shares of the width instead of evenly, as on a log scale. */
  positions?: readonly number[]
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<number | null>(null)
  const gesture = useRef<{ x: number; y: number; held: boolean; timer: ReturnType<typeof setTimeout> | null } | null>(null)

  useEffect(() => () => {
    if (gesture.current?.timer) clearTimeout(gesture.current.timer)
  }, [])

  function show(index: number | null) {
    setActive(index)
    onActive?.(index)
  }

  function indexAt(clientX: number): number | null {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || count === 0) return null
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    if (positions) return positions.reduce((best, at, i) => (Math.abs(at - frac) < Math.abs(positions[best]! - frac) ? i : best), 0)
    return mode === 'bar' ? Math.min(count - 1, Math.floor(frac * count)) : Math.round(frac * (count - 1))
  }

  function end() {
    if (gesture.current?.timer) clearTimeout(gesture.current.timer)
    gesture.current = null
  }

  const x = active === null ? null : positions ? positions[active]! * 100 : mode === 'bar' ? ((active + 0.5) / count) * 100 : count <= 1 ? 50 : (active / (count - 1)) * 100

  return (
    <div
      ref={ref}
      data-chart-scrub=""
      className={cn('relative select-none', className)}
      style={{ touchAction: 'pan-y', WebkitTouchCallout: 'none' }}
      // The tab strip swipes between tabs everywhere but on a chart.
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return
        const start = { x: e.clientX, y: e.clientY, held: false, timer: null as ReturnType<typeof setTimeout> | null }
        const clientX = e.clientX
        start.timer = setTimeout(() => {
          start.held = true
          show(indexAt(clientX))
        }, HOLD_MS)
        gesture.current = start
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse') {
          show(indexAt(e.clientX))
          return
        }
        const g = gesture.current
        if (!g) return
        if (g.held) show(indexAt(e.clientX))
        else if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > MOVE_TOLERANCE_PX && g.timer) {
          clearTimeout(g.timer)
          g.timer = null
        }
      }}
      onPointerUp={(e) => {
        const g = gesture.current
        if (g && !g.held) {
          const dx = e.clientX - g.x
          const dy = e.clientY - g.y
          if (onShift && Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 2) onShift(dx > 0 ? 1 : -1)
        }
        if (e.pointerType !== 'mouse') show(null)
        end()
      }}
      onPointerCancel={() => {
        show(null)
        end()
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') show(null)
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
      {active !== null && x !== null && (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-foreground" style={{ left: `${x}%` }} data-testid="scrub-hairline" />
          {/* Its own x% under the bar's x%: left-aligned at the first bar, right-aligned at the last, never past the card. */}
          <span
            role="status"
            className="pointer-events-none absolute -top-2 z-10 max-w-full truncate rounded-full bg-foreground px-2.5 py-1 text-[12px] font-semibold tabular-nums text-background"
            style={{ left: `${x}%`, translate: `-${x}% -100%` }}
          >
            {readout(active)}
          </span>
        </>
      )}
    </div>
  )
}

/**
 * The one "this week" mark on a weekly bar (v4.17): a week still under way is
 * dashed, as a planned session is. Weekly distance draws it as a dashed accent
 * outline over no fill; Long run and Time in zones keep their colours inside
 * the same dashed outline.
 */
export const THIS_WEEK_BORDER = '1.5px dashed var(--accent)'

/** A missed week's outline: a plan it had, and nothing run against it. */
export const MISSED_WEEK_BORDER = '1.5px dashed var(--muted-foreground)'

/**
 * A week with nothing run: a 2 pt stub on the baseline, so it reads as a
 * zero, not as no data. A week that had a plan and missed it is drawn taller
 * as a dashed outline instead, with a legend entry of its own (App Fixes 2c),
 * so a missed week and a week the plan never asked for stop looking alike.
 */
export function EmptyWeek({ missed = false }: { missed?: boolean } = {}) {
  if (!missed) return <div aria-hidden data-testid="empty-week" className="h-0.5 rounded-[1px] bg-[var(--band)]" />
  return <div aria-hidden data-testid="empty-week" data-missed="" className="h-2.5 rounded-[3px]" style={{ border: MISSED_WEEK_BORDER }} />
}
