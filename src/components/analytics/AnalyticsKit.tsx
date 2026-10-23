'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { GlassLayers } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/formatters'
import type { DeltaTone } from '@/lib/deltaTone'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import type { StatTone } from '@/components/ui/Stat'
import { t } from '@/i18n'

export function Card({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <section data-testid={testId} className={cardClass({ className: cn('flex flex-col gap-3', className) })}>
      {children}
    </section>
  )
}

/**
 * No measuring: in a wrapping row the caption moves under the title when its one-line width does not fit beside it,
 * and alone on its line `justify-between` puts it at the start.
 */
export function CardHead({ title, caption, about, right }: { title: string; caption?: ReactNode; about?: string; right?: ReactNode }) {
  const [open, setOpen] = useState(false)
  // Never truncated: the title keeps its words whole and the caption moves under it when the two do not fit one line.
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

export function Sentence({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <p data-testid={testId} className={cn('text-sm leading-normal text-[var(--text-2)] text-pretty [&_b]:font-semibold [&_b]:text-foreground', className)}>
      {children}
    </p>
  )
}

/** A sentence written as [before, bold, after]. */
export function BoldSentence({ parts, className, boldColor }: { parts: readonly [string, string, string]; className?: string; boldColor?: string }) {
  return (
    <Sentence className={className}>
      {parts[0]}
      <b style={boldColor ? { color: boldColor } : undefined}>{parts[1]}</b>
      {parts[2]}
    </Sentence>
  )
}

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

export const STAT_TONE: Record<DeltaTone, StatTone> = { good: 'pos', worse: 'warn', flat: 'muted' }

export { Legend, LegendItem } from '@/components/ui/Legend'

export function windowLabels(dates: string[], live: boolean): string[] {
  if (!dates.length) return []
  const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })
  const mid = dates[Math.floor((dates.length - 1) / 2)]!
  return [bare(dates[0]!), bare(mid), live ? t.analytics.cards.today : bare(dates[dates.length - 1]!)]
}

export function AxisLabels({ labels, className }: { labels: string[]; className?: string }) {
  return (
    <div className={cn('flex justify-between text-caption leading-none text-muted-foreground', className)} aria-hidden>
      {labels.map((label, i) => (
        <span key={i}>{label}</span>
      ))}
    </div>
  )
}

/** A radiogroup, not tabs: a period filters the tab under it, it is not a tab of its own. */
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
          // "4W" on screen, "4 weeks" read aloud.
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

  // Under the status bar, as every sheet: useScrollLock dims the strip itself.
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
        {/* No second "Close" here: the ×, the backdrop and Escape already dismiss. */}
        {actions && <div className="flex justify-end gap-2">{actions}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** A missing value is stepped over, so a week without a workout doesn't cut the line in two. */
export function linePath(values: (number | null)[], min: number, max: number, w: number, h: number): string {
  const n = values.length
  const range = max - min || 1
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v === null) return
    const x = n <= 1 ? w / 2 : (i / (n - 1)) * w
    const y = h - ((v - min) / range) * h
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    pen = true
  })
  return d
}

const HOLD_MS = 250
const MOVE_TOLERANCE_PX = 8
const SWIPE_PX = 56

/**
 * Press and hold for a hairline and a value chip; a horizontal swipe instead moves the tab's window in time. A mouse
 * gets the readout on hover.
 */
export function ChartScrub({
  count,
  mode = 'bar',
  readout,
  onShift,
  onActive,
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
    return mode === 'bar' ? Math.min(count - 1, Math.floor(frac * count)) : Math.round(frac * (count - 1))
  }

  function end() {
    if (gesture.current?.timer) clearTimeout(gesture.current.timer)
    gesture.current = null
  }

  const x = active === null ? null : mode === 'bar' ? ((active + 0.5) / count) * 100 : count <= 1 ? 50 : (active / (count - 1)) * 100

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
          <span
            role="status"
            className="pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-full bg-foreground px-2.5 py-1 text-[12px] font-semibold tabular-nums text-background"
            style={{ left: `clamp(0px, calc(${x}% - 60px), calc(100% - 120px))` }}
          >
            {readout(active)}
          </span>
        </>
      )}
    </div>
  )
}

/** A week still under way is dashed, as a planned session is. */
export const THIS_WEEK_BORDER = '1.5px dashed var(--accent)'

/** A missed week's outline: a plan it had, and nothing run against it. */
export const MISSED_WEEK_BORDER = '1.5px dashed var(--muted-foreground)'

/**
 * A stub on the baseline, so a week with nothing run reads as a zero, not as no data; a missed week is a taller
 * dashed outline, so it never looks like a week the plan never asked for.
 */
export function EmptyWeek({ missed = false }: { missed?: boolean } = {}) {
  if (!missed) return <div aria-hidden data-testid="empty-week" className="h-0.5 rounded-[1px] bg-[var(--band)]" />
  return <div aria-hidden data-testid="empty-week" data-missed="" className="h-2.5 rounded-[3px]" style={{ border: MISSED_WEEK_BORDER }} />
}
