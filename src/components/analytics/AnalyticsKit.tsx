'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

/**
 * The v4.5 card recipe (D1-D4): a title with its source or unit on the right,
 * then the number, one sentence, the chart and its legend. The (i) icons are
 * gone; the title itself opens the card's explanation.
 */
export function Card({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <section
      data-testid={testId}
      className={cn('flex flex-col gap-3 rounded-card border border-[var(--divider)] bg-card p-4', className)}
    >
      {children}
    </section>
  )
}

export function CardHead({ title, caption, about, right }: { title: string; caption?: ReactNode; about?: string; right?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-baseline justify-between gap-3">
      {about ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="min-w-0 truncate text-left font-display text-body font-bold leading-none text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {title}
        </button>
      ) : (
        <h2 className="min-w-0 truncate font-display text-body font-bold leading-none text-foreground">{title}</h2>
      )}
      {right ?? (caption && <span className="shrink-0 text-[12px] text-muted-foreground">{caption}</span>)}
      {open && about && (
        <Sheet title={title} onClose={() => setOpen(false)}>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{about}</p>
        </Sheet>
      )}
    </div>
  )
}

/** One sentence, 14 pt ink, with its key figure in bold. */
export function Sentence({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <p data-testid={testId} className={cn('text-[14px] leading-[1.4] text-foreground text-pretty', className)}>
      {children}
    </p>
  )
}

/** A sentence written as [before, bold, after]. */
export function BoldSentence({ parts, className }: { parts: readonly [string, string, string]; className?: string }) {
  return (
    <Sentence className={className}>
      {parts[0]}
      <b>{parts[1]}</b>
      {parts[2]}
    </Sentence>
  )
}

export function Headline({ value, note, size = 30, noteStyle }: { value: ReactNode; note?: ReactNode; size?: 24 | 30 | 40; noteStyle?: CSSProperties }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className="font-display font-bold leading-none tabular-nums text-foreground" style={{ fontSize: size }}>
        {value}
      </span>
      {note && (
        <span className="text-[13px] text-muted-foreground" style={noteStyle}>
          {note}
        </span>
      )}
    </div>
  )
}

type Swatch = 'square' | 'dot' | 'line' | 'dash' | 'ring' | 'dashRing'

export function LegendItem({ swatch, color, children }: { swatch: Swatch; color: string; children: ReactNode }) {
  const style: CSSProperties =
    swatch === 'line'
      ? { width: 14, height: 2, background: color }
      : swatch === 'dash'
        ? { width: 14, borderTop: `2px dashed ${color}` }
        : swatch === 'ring'
          ? { width: 8, height: 8, borderRadius: 2, border: `1.5px solid ${color}` }
          : swatch === 'dashRing'
            ? { width: 8, height: 8, borderRadius: '50%', border: `1.5px dashed ${color}` }
            : { width: 8, height: 8, borderRadius: swatch === 'dot' ? '50%' : 2, background: color }
  return (
    <span className="flex items-center gap-[5px]">
      <span aria-hidden className="box-border shrink-0" style={style} />
      {children}
    </span>
  )
}

export function Legend({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap gap-x-3.5 gap-y-1.5 text-caption text-muted-foreground', className)}>{children}</div>
}

/** Axis labels under a chart, spread end to end. */
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
 * The tab's one period control (v4.5): a small ink segment under the tabs,
 * the chosen period filled with ink. It replaces every card's own pills.
 */
export function PeriodControl<P extends string>({ periods, value, onChange }: { periods: readonly P[]; value: P; onChange: (p: P) => void }) {
  const s = t.analytics.cards.period
  return (
    <div role="radiogroup" aria-label={s.label} className="flex rounded-full bg-[var(--segmented-track)] p-[3px] text-[12px] font-semibold text-muted-foreground">
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={p === value}
          onClick={() => onChange(p)}
          className={cn(
            'rounded-full px-3 py-1.5 leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            p === value && 'bg-foreground font-bold text-background',
          )}
        >
          {s.short[p]}
        </button>
      ))}
    </div>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)
  const trapRef = useFocusTrap<HTMLDivElement>()
  useScrollLock()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [close])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4" style={{ touchAction: 'none' }} role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={close} />
      <div
        ref={trapRef}
        className="relative w-full animate-sheet-up sm:max-w-sm sm:rounded-card-sm"
        style={{ background: 'var(--raised)', boxShadow: 'var(--shadow-modal)', borderRadius: '22px 22px 20px 20px', border: '1px solid var(--border)', ...sheetStyle }}
      >
        <div className="flex justify-center pb-1 pt-3" {...handleProps}>
          <div className="h-1 w-9 rounded-full" style={{ background: 'var(--divider)' }} />
        </div>
        <div className="px-5 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}>
          <h2 className="mb-3 font-display text-[20px] font-bold text-foreground">{title}</h2>
          {children}
          <button type="button" onClick={close} className="mt-5 w-full rounded-full bg-[var(--segmented-track)] py-3 text-[15px] font-semibold text-foreground">
            {t.analytics.cards.close}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * An SVG path through values on a w×h box. A missing value is stepped over,
 * so a week without a workout doesn't cut the line in two.
 */
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
  children,
  className,
}: {
  count: number
  /** Bars sit in slots; a line's points sit on the ends. */
  mode?: 'bar' | 'line'
  readout: (index: number) => ReactNode
  /** +1 is one window older, -1 one newer. */
  onShift?: (step: 1 | -1) => void
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<number | null>(null)
  const gesture = useRef<{ x: number; y: number; held: boolean; timer: ReturnType<typeof setTimeout> | null } | null>(null)

  useEffect(() => () => {
    if (gesture.current?.timer) clearTimeout(gesture.current.timer)
  }, [])

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
          setActive(indexAt(clientX))
        }, HOLD_MS)
        gesture.current = start
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse') {
          setActive(indexAt(e.clientX))
          return
        }
        const g = gesture.current
        if (!g) return
        if (g.held) setActive(indexAt(e.clientX))
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
        if (e.pointerType !== 'mouse') setActive(null)
        end()
      }}
      onPointerCancel={() => {
        setActive(null)
        end()
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setActive(null)
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

/**
 * The one "this week" mark on a weekly bar (v4.6): a 2 pt accent outline over
 * a 15% accent wash, as Plan draws today. Weekly distance, Long run and Time in
 * zones all use it.
 */
export const THIS_WEEK_FILL = 'color-mix(in oklab, var(--accent) 15%, transparent)'
export const THIS_WEEK_OUTLINE = 'inset 0 0 0 2px var(--accent)'

/** A week with nothing run: a 2 pt stub on the baseline, so it reads as a zero, not as no data. */
export function EmptyWeek() {
  return <div aria-hidden data-testid="empty-week" className="h-0.5 rounded-[1px] bg-[var(--band)]" />
}
