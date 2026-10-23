'use client'

import { ChevronRight } from 'lucide-react'
import { t } from '@/i18n'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'

export interface ExportOption {
  key: string
  title: string
  extension: string
  hint: string
  onSelect: () => void
}

interface Props {
  options: ExportOption[]
  onClose: () => void
}

export function ExportSheet({ options, onClose }: Props) {
  const s = t.settings

  return (
    <Sheet
      onClose={onClose}
      title={s.dataExport.sheetTitle}
      titleId="export-sheet-title"
      showClose={false}
      footer={(close) => (
        <Button size="lg" variant="secondary" className="w-full text-accent-text" onClick={close}>
          {s.actions.confirmCancel}
        </Button>
      )}
    >
      {(close) => (
      <ul className="inset-group mt-2.5 overflow-hidden rounded-[25px] bg-[var(--fill-4)] [--row-inset:16px]">
        {options.map((format) => (
          <li key={format.key}>
            <button
              type="button"
              data-testid={`export-${format.key}`}
              onClick={() => { close(); format.onSelect() }}
              className="flex min-h-[72px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors active:bg-[var(--fill-4)]"
            >
              <span className="min-w-0">
                <span className="block text-[17px] text-foreground">
                  {format.title}
                  <span className="ml-1.5 text-[13px] font-medium text-accent-text">{format.extension}</span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{format.hint}</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      )}
    </Sheet>
  )
}
