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

  const surface = {
    background: 'var(--raised)',
    boxShadow: 'var(--shadow-modal)',
    border: '1px solid var(--border)',
  }

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--safe-top)] z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
      style={{ touchAction: 'none' }}
      role="dialog"
      aria-modal="true"
      aria-label={s.dataExport.sheetTitle}
    >
      <div className="absolute inset-0 bg-black/55" onClick={close} />

      <div
        ref={trapRef}
        className="relative flex w-full animate-sheet-up flex-col gap-2 px-2 sm:max-w-sm sm:px-0"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)', ...sheetStyle }}
      >
        <div className="rounded-[28px] px-5 pb-2 pt-2.5" style={surface}>
          <div className="flex justify-center pb-3" {...handleProps}>
            <div className="h-[5px] w-9 rounded-full" style={{ background: 'var(--muted-foreground)', opacity: 0.5 }} />
          </div>
          <h2 className="border-b border-border pb-3 text-center text-sm font-medium text-muted-foreground">
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
                    <span className="block text-[17px] text-foreground">
                      {format.title}
                      <span className="ml-1.5 text-[13px] font-medium text-accent-text">{format.extension}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{format.hint}</span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-2xl leading-none text-muted-foreground">›</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={close}
          className="h-14 w-full rounded-[28px] text-[17px] font-semibold text-accent-text transition-opacity active:opacity-60"
          style={surface}
        >
          {s.actions.confirmCancel}
        </button>
      </div>
    </div>,
    document.body,
  )
}
