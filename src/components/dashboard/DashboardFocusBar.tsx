'use client'

import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { useDashboardFocus } from './DashboardFocusContext'

export function DashboardFocusBar() {
  const { editMode, setEditMode, resetLayout } = useDashboardFocus()

  return (
    <div className="flex items-center gap-2">
      {editMode && (
        <button
          type="button"
          onClick={resetLayout}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t.dashboard.focus.reset}
        </button>
      )}
      <button
        type="button"
        onClick={() => setEditMode(!editMode)}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
          editMode
            ? 'border-transparent bg-accent text-accent-text'
            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {editMode ? t.dashboard.focus.done : t.dashboard.focus.customize}
      </button>
    </div>
  )
}
