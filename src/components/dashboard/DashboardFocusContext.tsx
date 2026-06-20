'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'dashboard-focus-v1'

export const DASHBOARD_WIDGET_ORDER = ['stats', 'trainingOverview', 'charts', 'heatmap', 'recentActivities'] as const
export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_ORDER)[number]

interface DashboardFocusState {
  order: DashboardWidgetId[]
  hidden: DashboardWidgetId[]
}

interface DashboardFocusContextValue extends DashboardFocusState {
  editMode: boolean
  setEditMode: (editMode: boolean) => void
  toggleHidden: (id: DashboardWidgetId) => void
  moveWidget: (id: DashboardWidgetId, direction: -1 | 1) => void
  resetLayout: () => void
}

const defaultState: DashboardFocusState = { order: [...DASHBOARD_WIDGET_ORDER], hidden: [] }

function isWidgetId(value: string): value is DashboardWidgetId {
  return (DASHBOARD_WIDGET_ORDER as readonly string[]).includes(value)
}

function readStoredState(): DashboardFocusState {
  if (typeof window === 'undefined') return defaultState
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultState
  try {
    const parsed = JSON.parse(raw) as DashboardFocusState
    const order = parsed.order.filter(isWidgetId)
    const missing = DASHBOARD_WIDGET_ORDER.filter((id) => !order.includes(id))
    return { order: [...order, ...missing], hidden: parsed.hidden.filter(isWidgetId) }
  } catch {
    return defaultState
  }
}

const DashboardFocusContext = createContext<DashboardFocusContextValue | null>(null)

export function DashboardFocusProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DashboardFocusState>(readStoredState)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  function toggleHidden(id: DashboardWidgetId) {
    setState((s) => ({
      ...s,
      hidden: s.hidden.includes(id) ? s.hidden.filter((h) => h !== id) : [...s.hidden, id],
    }))
  }

  function moveWidget(id: DashboardWidgetId, direction: -1 | 1) {
    setState((s) => {
      const index = s.order.indexOf(id)
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= s.order.length) return s
      const order = [...s.order]
      ;[order[index], order[targetIndex]] = [order[targetIndex], order[index]]
      return { ...s, order }
    })
  }

  function resetLayout() {
    setState(defaultState)
  }

  return (
    <DashboardFocusContext.Provider
      value={{ ...state, editMode, setEditMode, toggleHidden, moveWidget, resetLayout }}
    >
      {children}
    </DashboardFocusContext.Provider>
  )
}

export function useDashboardFocus() {
  const ctx = useContext(DashboardFocusContext)
  if (!ctx) throw new Error('useDashboardFocus must be used within DashboardFocusProvider')
  return ctx
}
