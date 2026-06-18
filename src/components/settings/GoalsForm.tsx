'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { GoalYear, GoalTarget } from '@/application/usecases/GetGoalsData'
import { t } from '@/i18n'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const DISTANCES = ['5K', '10K', 'Half-Marathon', 'Marathon'] as const

export function GoalsForm() {
  const [goals, setGoals] = useState<GoalYear[]>([])
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({})

  useEffect(() => {
    const db = getClientFirestore()
    getDocs(collection(db, 'goals')).then((snap) => {
      const data = snap.docs
        .map((d) => d.data() as GoalYear)
        .sort((a, b) => b.year - a.year)
      setGoals(data)
    })
  }, [])

  function updateGoal(year: number, field: 'annualDistanceKm', value: number) {
    setGoals((prev) =>
      prev.map((g) => (g.year === year ? { ...g, [field]: value } : g))
    )
    setSaveStates((s) => ({ ...s, [year]: 'idle' }))
  }

  function updateTarget(year: number, distance: string, raw: string) {
    const seconds = raw === '' ? null : Number(raw)
    setGoals((prev) =>
      prev.map((g) => {
        if (g.year !== year) return g
        const targets = g.targets.map((tgt) =>
          tgt.distance === distance ? { ...tgt, targetSeconds: seconds } : tgt
        )
        if (!targets.find((t) => t.distance === distance)) {
          targets.push({ distance, targetSeconds: seconds })
        }
        return { ...g, targets }
      })
    )
    setSaveStates((s) => ({ ...s, [year]: 'idle' }))
  }

  function addYear() {
    const nextYear = (goals[0]?.year ?? new Date().getFullYear()) + 1
    const newGoal: GoalYear = {
      year: nextYear,
      annualDistanceKm: 0,
      targets: DISTANCES.map((d) => ({ distance: d, targetSeconds: null })),
    }
    setGoals((prev) => [newGoal, ...prev])
  }

  function removeYear(year: number) {
    setGoals((prev) => prev.filter((g) => g.year !== year))
  }

  async function saveYear(year: number) {
    const goal = goals.find((g) => g.year === year)
    if (!goal) return
    setSaveStates((s) => ({ ...s, [year]: 'saving' }))
    try {
      const db = getClientFirestore()
      await setDoc(doc(db, 'goals', String(year)), goal)
      setSaveStates((s) => ({ ...s, [year]: 'saved' }))
    } catch {
      setSaveStates((s) => ({ ...s, [year]: 'error' }))
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t.settings.goals.title}</h2>
        <button
          type="button"
          onClick={addYear}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          + {t.settings.goals.addYear}
        </button>
      </div>

      {goals.map((goal) => (
        <GoalYearCard
          key={goal.year}
          goal={goal}
          saveState={saveStates[goal.year] ?? 'idle'}
          onUpdateKm={(km) => updateGoal(goal.year, 'annualDistanceKm', km)}
          onUpdateTarget={(d, v) => updateTarget(goal.year, d, v)}
          onSave={() => saveYear(goal.year)}
          onRemove={() => removeYear(goal.year)}
        />
      ))}
    </section>
  )
}

function GoalYearCard({
  goal,
  saveState,
  onUpdateKm,
  onUpdateTarget,
  onSave,
  onRemove,
}: {
  goal: GoalYear
  saveState: SaveState
  onUpdateKm: (km: number) => void
  onUpdateTarget: (distance: string, value: string) => void
  onSave: () => void
  onRemove: () => void
}) {
  function targetValue(distance: string): string {
    const tgt = goal.targets.find((t: GoalTarget) => t.distance === distance)
    return tgt?.targetSeconds != null ? String(tgt.targetSeconds) : ''
  }

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{goal.year}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted-foreground transition-colors hover:text-destructive"
        >
          {t.settings.goals.removeYear}
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">{t.settings.goals.annualKm}</label>
        <input
          type="number"
          value={goal.annualDistanceKm || ''}
          onChange={(e) => onUpdateKm(Number(e.target.value))}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t.settings.goals.raceTargets}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {DISTANCES.map((d) => (
            <div key={d} className="space-y-1">
              <label className="text-xs text-muted-foreground">{d} ({t.settings.goals.optional})</label>
              <input
                type="number"
                placeholder={t.settings.goals.targetSeconds}
                value={targetValue(d)}
                onChange={(e) => onUpdateTarget(d, e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>
          ))}
        </div>
      </div>

      <SaveButton state={saveState} onClick={onSave} />
    </div>
  )
}

function SaveButton({ state, onClick }: { state: SaveState; onClick: () => void }) {
  const label =
    state === 'saving' ? t.settings.actions.saving :
    state === 'saved' ? t.settings.actions.saved :
    state === 'error' ? t.settings.actions.error :
    t.settings.actions.save

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'saving'}
      className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-50"
    >
      {label}
    </button>
  )
}
