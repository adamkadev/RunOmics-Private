'use client'

import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { useDashboardFocus, type DashboardWidgetId } from './DashboardFocusContext'

export interface DashboardWidget {
  id: DashboardWidgetId
  element: ReactNode
}

export function DashboardWidgets({ widgets }: { widgets: DashboardWidget[] }) {
  const { order, hidden, editMode, toggleHidden, moveWidget } = useDashboardFocus()
  const byId = new Map(widgets.map((w) => [w.id, w]))
  const visibleOrder = order.filter((id) => byId.has(id))

  return (
    <>
      {visibleOrder.map((id, index) => {
        const isHidden = hidden.includes(id)
        if (isHidden && !editMode) return null

        const widgetLabel = t.dashboard.focus.widgets[id]

        return (
          <div key={id} className={cn('relative space-y-6', isHidden && 'opacity-40')}>
            {editMode && (
              <div className="absolute -top-3 right-0 z-10 flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => moveWidget(id, -1)}
                  disabled={index === 0}
                  aria-label={`${t.dashboard.focus.moveUp} ${widgetLabel}`}
                  className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveWidget(id, 1)}
                  disabled={index === visibleOrder.length - 1}
                  aria-label={`${t.dashboard.focus.moveDown} ${widgetLabel}`}
                  className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleHidden(id)}
                  aria-label={`${isHidden ? t.dashboard.focus.show : t.dashboard.focus.hide} ${widgetLabel}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}
            {byId.get(id)!.element}
          </div>
        )
      })}
    </>
  )
}
