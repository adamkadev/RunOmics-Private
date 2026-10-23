'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { GlassLayers } from '@/components/ui/GlassSurface'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export const MEDIUM_DETENT_MAX = 0.75

export type SheetDetent = 'medium' | 'large'

export function detentFor(contentHeight: number, viewportHeight: number): SheetDetent {
  return contentHeight <= MEDIUM_DETENT_MAX * viewportHeight ? 'medium' : 'large'
}

type Slot = ReactNode | ((close: () => void) => ReactNode)

const render = (slot: Slot, close: () => void) => (typeof slot === 'function' ? slot(close) : slot)

/** A fill, never glass: glass is never nested in glass. */
export const SHEET_CONTROL = 'hit-44 flex h-11 shrink-0 items-center justify-center rounded-full bg-[var(--sheet-fill)] shadow-[var(--sheet-fill-rim)]'

/** z-[60]: above the fullscreen maps (z-50), whose filters open a sheet. */
export function Sheet({
  onClose,
  title,
  titleId,
  label,
  action,
  trailing,
  showClose = true,
  footer,
  detent: fixedDetent,
  testId,
  bodyClassName,
  children,
}: {
  onClose: () => void
  title?: ReactNode
  /** The heading that names the dialog: the header's title, or one in the content. */
  titleId?: string
  label?: string
  action?: { label: string; onClick: () => void; disabled?: boolean }
  trailing?: ReactNode
  showClose?: boolean
  footer?: Slot
  detent?: SheetDetent
  testId?: string
  bodyClassName?: string
  children: Slot
}) {
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)
  const trapRef = useFocusTrap<HTMLDivElement>()
  const contentRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<SheetDetent>('medium')
  const detent = fixedDetent ?? measured

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [close])

  useScrollLock()

  useLayoutEffect(() => {
    if (fixedDetent) return
    const measure = () => {
      const el = contentRef.current
      if (el) setMeasured(detentFor(el.scrollHeight, window.innerHeight))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [fixedDetent])

  const medium = detent === 'medium'

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-[60] flex items-end sm:items-center sm:justify-center sm:p-4"
      style={{ touchAction: 'none' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-label={titleId ? undefined : label}
    >
      <div className="absolute inset-0 animate-[fade-in_250ms_ease-out_both] bg-[var(--scrim-sheet)]" onClick={close} />

      <div
        ref={trapRef}
        data-testid={testId}
        data-detent={detent}
        className={cn(
          'lg lg-sheet relative flex w-full animate-[sheet-rise_520ms_cubic-bezier(0.22,1,0.36,1)_both] flex-col sm:max-w-sm',
          'transition-[margin,border-radius] duration-[380ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
          medium
            ? 'm-[var(--sheet-inset)] max-h-[calc(100%_-_16px)] rounded-[var(--radius-sheet)] sm:rounded-[var(--radius-sheet)]'
            : 'max-h-full rounded-t-[var(--radius-sheet-large)] rounded-b-none sm:rounded-[var(--radius-sheet-large)]',
        )}
        style={sheetStyle}
      >
        <GlassLayers />
        <div
          ref={contentRef}
          className="flex min-h-0 flex-1 flex-col px-[var(--sheet-pad)] pt-1.5"
          style={{ paddingBottom: medium ? 'var(--sheet-pad)' : 'max(env(safe-area-inset-bottom), var(--sheet-pad))' }}
        >
          <div className="-mx-[var(--sheet-pad)] flex justify-center pb-2.5" {...handleProps}>
            <span aria-hidden="true" className="h-[5px] w-9 rounded-[2.5px] bg-[rgb(127_127_127/0.45)]" />
          </div>

          {(showClose || title || action || trailing) && (
            <div className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
              <span className="flex justify-start">
                {showClose && (
                  <button type="button" onClick={close} aria-label={t.common.close} className={cn(SHEET_CONTROL, 'w-11 text-foreground')}>
                    <X size={20} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                )}
              </span>
              {title ? (
                <h2 id={titleId} className="min-w-0 truncate text-center text-headline text-foreground">
                  {title}
                </h2>
              ) : (
                <span />
              )}
              <span className="flex justify-end">
                {trailing}
                {!trailing && action && (
                  <button
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={cn(SHEET_CONTROL, 'px-4 text-[17px] text-accent-text disabled:opacity-40')}
                  >
                    {action.label}
                  </button>
                )}
              </span>
            </div>
          )}

          <div className={cn('-mx-[var(--sheet-pad)] min-h-0 flex-1 overflow-y-auto px-[var(--sheet-pad)]', bodyClassName)} style={{ touchAction: 'pan-y' }}>
            {render(children, close)}
          </div>

          {footer && <div className="shrink-0 pt-6">{render(footer, close)}</div>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function SheetSection({ title, label, children, className }: { title: ReactNode; label?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={label} className={cn('mt-[18px] first:mt-2.5', className)}>
      <h3 className="mb-2.5 text-[13px] font-semibold leading-[18px] text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}
