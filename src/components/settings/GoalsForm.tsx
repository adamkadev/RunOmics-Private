'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { GoalYear, GoalTarget } from '@/application/usecases/GetGoalsData'
import { formatDuration, parseTimeInput } from '@/lib/formatters'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { cardClass } from '@/components/ui/Card'
import { SaveButton, type SaveState } from '@/components/ui/SaveButton'

type Toast = { msg: string; ok: boolean } | null

const DISTANCES = t.settings.pbs.distanceOptions as readonly string[]

function targetToInput(tgt: GoalTarget | undefined): string {
  return tgt?.targetSeconds != null ? formatDuration(tgt.targetSeconds) : ''
}

export function GoalsForm() {
  const [goals, setGoals] = useState<GoalYear[]>([])
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({})
  const [toast, setToast] = useState<Toast>(null)
  const [confirmYear, setConfirmYear] = useState<number | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), ok ? 2000 : 3500)
  }

  useEffect(() => {
    getDocs(collection(getClientFirestore(), 'goals')).then((snap) => {
      setGoals(
        snap.docs.map((d) => d.data() as GoalYear).sort((a, b) => b.year - a.year)
      )
    })
  }, [])

  function updateKm(year: number, value: string) {
    setGoals((prev) =>
      prev.map((g) => (g.year === year ? { ...g, annualDistanceKm: Number(value) } : g))
    )
    setSaveStates((s) => ({ ...s, [year]: 'idle' }))
  }

  function updateTarget(year: number, distance: string, raw: string) {
    const seconds = raw === '' ? null : (parseTimeInput(raw) ?? null)
    setGoals((prev) =>
      prev.map((g) => {
        if (g.year !== year) return g
        const existing = g.targets.find((t) => t.distance === distance)
        const targets = existing
          ? g.targets.map((t) => (t.distance === distance ? { ...t, targetSeconds: seconds } : t))
          : [...g.targets, { distance, targetSeconds: seconds }]
        return { ...g, targets }
      })
    )
    setSaveStates((s) => ({ ...s, [year]: 'idle' }))
  }

  function addYear() {
    const next = (goals[0]?.year ?? new Date().getFullYear()) + 1
    setGoals((prev) => [
      { year: next, annualDistanceKm: 0, targets: DISTANCES.map((d) => ({ distance: d, targetSeconds: null })) },
      ...prev,
    ])
  }

  function removeYear(year: number) {
    setGoals((prev) => prev.filter((g) => g.year !== year))
  }

  async function saveYear(year: number) {
    const goal = goals.find((g) => g.year === year)
    if (!goal) return
    setSaveStates((s) => ({ ...s, [year]: 'saving' }))
    try {
      await setDoc(doc(getClientFirestore(), 'goals', String(year)), goal)
      setSaveStates((s) => ({ ...s, [year]: 'saved' }))
      showToast(t.settings.actions.saved, true)
    } catch {
      setSaveStates((s) => ({ ...s, [year]: 'error' }))
      showToast(t.settings.actions.error, false)
    }
  }

  return (
    <section className={cardClass({ padding: 'none' })}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{t.settings.goals.title}</h2>
        <button
          type="button"
          onClick={addYear}
          className="text-xs font-medium text-accent-text transition-colors hover:text-accent-text/70"
        >
          + {t.settings.goals.addYear}
        </button>
      </div>

      <div className="divide-y divide-border">
        {goals.map((goal) => (
          <div key={goal.year} className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-foreground">{goal.year}</span>
              {confirmYear === goal.year ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{t.settings.actions.confirmQuestion}</span>
                  <button type="button" onClick={() => { removeYear(goal.year); setConfirmYear(null) }} className="font-medium text-destructive hover:text-destructive/70">
                    {t.settings.actions.confirmYes}
                  </button>
                  <button type="button" onClick={() => setConfirmYear(null)} className="text-muted-foreground hover:text-foreground">
                    {t.settings.actions.confirmCancel}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmYear(goal.year)}
                  className="text-xs text-destructive transition-colors hover:text-destructive/70"
                >
                  {t.settings.goals.removeYear}
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t.settings.goals.annualKm}</label>
              <input
                type="number"
                value={goal.annualDistanceKm || ''}
                onChange={(e) => updateKm(goal.year, e.target.value)}
                className={inputCls}
                placeholder={t.settings.goals.placeholders.annualKm}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t.settings.goals.raceTargets} <span className="text-xs font-normal text-muted-foreground">({t.settings.goals.targetTime})</span></p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DISTANCES.map((d) => (
                  <div key={d} className="space-y-1">
                    <label className="text-xs text-muted-foreground">{d}</label>
                    <input
                      type="text"
                      placeholder={t.settings.goals.placeholders.targetTime}
                      value={targetToInput(goal.targets.find((tt) => tt.distance === d))}
                      onChange={(e) => updateTarget(goal.year, d, e.target.value)}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </div>

            <SaveButton state={saveStates[goal.year] ?? 'idle'} onClick={() => saveYear(goal.year)} />
          </div>
        ))}
      </div>

      {toast && (
        <div className={cn(
          'fixed bottom-4 right-4 z-50 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg',
          toast.ok ? 'bg-accent' : 'bg-destructive'
        )}>
          {toast.msg}
        </div>
      )}
    </section>
  )
}

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent'
