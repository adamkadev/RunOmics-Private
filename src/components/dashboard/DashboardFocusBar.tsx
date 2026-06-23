'use client'

import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import { t } from '@/i18n'
import { useDashboardFocus } from './DashboardFocusContext'

export function DashboardFocusBar() {
  const { editMode, setEditMode, resetLayout } = useDashboardFocus()

  return (
    <div className="flex items-center gap-2">
      {editMode && (
        <Button variant="ghost" onClick={resetLayout} className="rounded-full px-3 py-1.5 text-xs">
          <RotateCcw className="h-3.5 w-3.5" />
          {t.dashboard.focus.reset}
        </Button>
      )}
      <Pill
        as="button"
        variant={editMode ? 'active' : 'neutral'}
        onClick={() => setEditMode(!editMode)}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {editMode ? t.dashboard.focus.done : t.dashboard.focus.customize}
      </Pill>
    </div>
  )
}
