'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { PbYear, PbEntry } from '@/application/usecases/GetGoalsData'
import { t } from '@/i18n'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const DISTANCES = t.settings.pbs.distanceOptions as readonly string[]

export function PbsForm() {
  const [pbYears, setPbYears] = useState<PbYear[]>([])
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({})

  useEffect(() => {
    const db = getClientFirestore()
    getDocs(collection(db, 'pbs')).then((snap) => {
      const data = snap.docs
        .map((d) => d.data() as PbYear)
        .sort((a, b) => b.year - a.year)
      setPbYears(data)
    })
  }, [])

  function updateEntry(year: number, idx: number, field: keyof PbEntry, value: string) {
    setPbYears((prev) =>
      prev.map((py) => {
        if (py.year !== year) return py
        const entries = py.entries.map((e, i) => {
          if (i !== idx) return e
          if (field === 'seconds') return { ...e, seconds: Number(value) }
          return { ...e, [field]: value }
        })
        return { ...py, entries }
      })
    )
    setSaveStates((s) => ({ ...s, [year]: 'idle' }))
  }

  function addEntry(year: number) {
    setPbYears((prev) =>
      prev.map((py) =>
        py.year !== year
          ? py
          : { ...py, entries: [...py.entries, { distance: '5K', seconds: 0, activityId: '' }] }
      )
    )
  }

  function removeEntry(year: number, idx: number) {
    setPbYears((prev) =>
      prev.map((py) =>
        py.year !== year ? py : { ...py, entries: py.entries.filter((_, i) => i !== idx) }
      )
    )
    setSaveStates((s) => ({ ...s, [year]: 'idle' }))
  }

  function addYear() {
    const nextYear = (pbYears[0]?.year ?? new Date().getFullYear()) + 1
    setPbYears((prev) => [{ year: nextYear, entries: [] }, ...prev])
  }

  function removeYear(year: number) {
    setPbYears((prev) => prev.filter((py) => py.year !== year))
  }

  async function saveYear(year: number) {
    const pbYear = pbYears.find((py) => py.year === year)
    if (!pbYear) return
    setSaveStates((s) => ({ ...s, [year]: 'saving' }))
    try {
      const db = getClientFirestore()
      await setDoc(doc(db, 'pbs', String(year)), pbYear)
      setSaveStates((s) => ({ ...s, [year]: 'saved' }))
    } catch {
      setSaveStates((s) => ({ ...s, [year]: 'error' }))
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t.settings.pbs.title}</h2>
        <button
          type="button"
          onClick={addYear}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          + {t.settings.pbs.addYear}
        </button>
      </div>

      {pbYears.map((pbYear) => (
        <PbYearCard
          key={pbYear.year}
          pbYear={pbYear}
          saveState={saveStates[pbYear.year] ?? 'idle'}
          onUpdateEntry={(idx, field, val) => updateEntry(pbYear.year, idx, field, val)}
          onAddEntry={() => addEntry(pbYear.year)}
          onRemoveEntry={(idx) => removeEntry(pbYear.year, idx)}
          onSave={() => saveYear(pbYear.year)}
          onRemove={() => removeYear(pbYear.year)}
        />
      ))}
    </section>
  )
}

function PbYearCard({
  pbYear,
  saveState,
  onUpdateEntry,
  onAddEntry,
  onRemoveEntry,
  onSave,
  onRemove,
}: {
  pbYear: PbYear
  saveState: SaveState
  onUpdateEntry: (idx: number, field: keyof PbEntry, value: string) => void
  onAddEntry: () => void
  onRemoveEntry: (idx: number) => void
  onSave: () => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{pbYear.year}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted-foreground transition-colors hover:text-destructive"
        >
          {t.settings.pbs.removeYear}
        </button>
      </div>

      {pbYear.entries.map((entry, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t.settings.pbs.distance}</label>
            <select
              value={entry.distance}
              onChange={(e) => onUpdateEntry(idx, 'distance', e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              {DISTANCES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t.settings.pbs.seconds}</label>
            <input
              type="number"
              value={entry.seconds || ''}
              onChange={(e) => onUpdateEntry(idx, 'seconds', e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t.settings.pbs.activityId}</label>
            <input
              type="text"
              value={entry.activityId}
              onChange={(e) => onUpdateEntry(idx, 'activityId', e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
          <button
            type="button"
            onClick={() => onRemoveEntry(idx)}
            className="pb-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            {t.settings.pbs.removeEntry}
          </button>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onAddEntry}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          + {t.settings.pbs.addEntry}
        </button>
        <SaveButton state={saveState} onClick={onSave} />
      </div>
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
