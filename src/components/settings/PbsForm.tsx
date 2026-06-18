'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { PbYear, PbEntry } from '@/application/usecases/GetGoalsData'
import { formatDuration, parseTimeInput } from '@/lib/formatters'
import { t } from '@/i18n'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const DISTANCES = t.settings.pbs.distanceOptions as readonly string[]

function secsToInput(s: number): string {
  return s > 0 ? formatDuration(s) : ''
}

export function PbsForm() {
  const [pbYears, setPbYears] = useState<PbYear[]>([])
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({})

  useEffect(() => {
    getDocs(collection(getClientFirestore(), 'pbs')).then((snap) => {
      setPbYears(
        snap.docs.map((d) => d.data() as PbYear).sort((a, b) => b.year - a.year)
      )
    })
  }, [])

  function updateEntry(year: number, idx: number, field: keyof PbEntry, value: string) {
    setPbYears((prev) =>
      prev.map((py) => {
        if (py.year !== year) return py
        const entries = py.entries.map((e, i) => {
          if (i !== idx) return e
          if (field === 'seconds') {
            const parsed = parseTimeInput(value)
            return { ...e, seconds: parsed ?? e.seconds }
          }
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
    const next = (pbYears[0]?.year ?? new Date().getFullYear()) + 1
    setPbYears((prev) => [{ year: next, entries: [] }, ...prev])
  }

  function removeYear(year: number) {
    setPbYears((prev) => prev.filter((py) => py.year !== year))
  }

  async function saveYear(year: number) {
    const pbYear = pbYears.find((py) => py.year === year)
    if (!pbYear) return
    setSaveStates((s) => ({ ...s, [year]: 'saving' }))
    try {
      await setDoc(doc(getClientFirestore(), 'pbs', String(year)), pbYear)
      setSaveStates((s) => ({ ...s, [year]: 'saved' }))
    } catch {
      setSaveStates((s) => ({ ...s, [year]: 'error' }))
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{t.settings.pbs.title}</h2>
        <button
          type="button"
          onClick={addYear}
          className="text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400"
        >
          + {t.settings.pbs.addYear}
        </button>
      </div>

      <div className="divide-y divide-border">
        {pbYears.map((pbYear) => (
          <div key={pbYear.year} className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-foreground">{pbYear.year}</span>
              <button
                type="button"
                onClick={() => removeYear(pbYear.year)}
                className="text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                {t.settings.pbs.removeYear}
              </button>
            </div>

            <div className="space-y-2">
              {pbYear.entries.map((entry, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t.settings.pbs.distance}</label>
                      <select
                        value={entry.distance}
                        onChange={(e) => updateEntry(pbYear.year, idx, 'distance', e.target.value)}
                        className={inputCls}
                      >
                        {DISTANCES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t.settings.pbs.seconds}</label>
                      <input
                        type="text"
                        placeholder="mm:ss"
                        defaultValue={secsToInput(entry.seconds)}
                        onBlur={(e) => updateEntry(pbYear.year, idx, 'seconds', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-muted-foreground">{t.settings.pbs.activityId}</label>
                      <input
                        type="text"
                        value={entry.activityId}
                        onChange={(e) => updateEntry(pbYear.year, idx, 'activityId', e.target.value)}
                        className={inputCls}
                        placeholder="12345678901"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEntry(pbYear.year, idx)}
                      className="mb-0.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
                    >
                      {t.settings.pbs.removeEntry}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => addEntry(pbYear.year)}
                className="text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400"
              >
                + {t.settings.pbs.addEntry}
              </button>
              <SaveButton state={saveStates[pbYear.year] ?? 'idle'} onClick={() => saveYear(pbYear.year)} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500'

function SaveButton({ state, onClick }: { state: SaveState; onClick: () => void }) {
  const label =
    state === 'saving' ? t.settings.actions.saving :
    state === 'saved'  ? t.settings.actions.saved  :
    state === 'error'  ? t.settings.actions.error  :
    t.settings.actions.save

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'saving'}
      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
    >
      {label}
    </button>
  )
}
