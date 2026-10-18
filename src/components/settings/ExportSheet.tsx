'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { t } from '@/i18n'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { useScrollLock } from '@/lib/useScrollLock'

export interface ExportOption {
  key: string
  title: string
  /** File type, shown beside the title. */
  extension: string
  hint: string
  onSelect: () => void
}

interface Props {
  options: ExportOption[]
  onClose: () => void
}

/**
 * One export row on the card, the format picked here (design review, Oct 2026):
 * two near-identical rows left the reader guessing which file was which.
 */
export function ExportSheet({ options, onClose }: Props) {
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)
  const trapRef = useFocusTrap<HTMLDivElement>()
  const s = t.settings

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [close])

  useScrollLock()

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
      style={{ touchAction: 'none' }}
      role="dialog"
      aria-modal="true"
      aria-label={s.dataExport.sheetTitle}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={close} />

      <div
        ref={trapRef}
        className="relative w-full animate-sheet-up sm:max-w-sm"
        style={{
          background: 'var(--raised)',
          boxShadow: 'var(--shadow-modal)',
          borderRadius: '22px 22px 20px 20px',
          border: '1px solid var(--border)',
          ...sheetStyle,
        }}
      >
        <div className="flex justify-center pt-3 pb-1" {...handleProps}>
          <div className="h-1 w-9 rounded-full" style={{ background: 'var(--divider)' }} />
        </div>

        <div className="px-5 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
          <h2 className="border-b border-border pb-3 text-center text-xs text-muted-foreground">
            {s.dataExport.sheetTitle}
          </h2>
          <ul>
            {options.map((format) => (
              <li key={format.key} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  data-testid={`export-${format.key}`}
                  onClick={() => { close(); format.onSelect() }}
                  className="flex min-h-[72px] w-full items-center justify-between gap-3 py-3 text-left transition-opacity active:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block text-base text-foreground">
                      {format.title}
                      <span className="ml-1.5 text-xs font-medium text-accent-text">{format.extension}</span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{format.hint}</span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-lg text-muted-foreground">›</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={close}
            className="hit-44 mt-2 w-full rounded-card-sm py-3 text-center text-base font-semibold text-accent-text transition-opacity active:opacity-60"
          >
            {s.actions.confirmCancel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
