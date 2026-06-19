'use client'

import { t } from '@/i18n'
import { cn } from '@/lib/utils'

interface Props {
  confirming: boolean
  onRequestConfirm: () => void
  onConfirm: () => void
  onCancel: () => void
  label: string
  className?: string
}

export function ConfirmDelete({ confirming, onRequestConfirm, onConfirm, onCancel, label, className }: Props) {
  if (confirming) {
    return (
      <span className={cn('flex items-center gap-1 text-xs', className)}>
        <span className="px-1 text-muted-foreground">{t.settings.actions.confirmQuestion}</span>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md px-2 py-1.5 font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          {t.settings.actions.confirmYes}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {t.settings.actions.confirmCancel}
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onRequestConfirm}
      className={cn('shrink-0 rounded-md px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10', className)}
    >
      {label}
    </button>
  )
}
