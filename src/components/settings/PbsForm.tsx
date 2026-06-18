'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { PbYear, PbEntry } from '@/application/usecases/GetGoalsData'
import { formatDuration, parseTimeInput } from '@/lib/formatters'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { cardClass } from '@/components/ui/Card'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type Toast = { msg: string; ok: boolean } | null

const DISTANCES = t.settings.pbs.distanceOptions as readonly string[]

function secsToInput(s: number): string {
  return s > 0 ? formatDuration(s) : ''
}

export function PbsForm() {
  const [pbYears, setPbYears] = useState<PbYear[]>([])
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({})
  const [toast, setToast] = useState<Toast>(null)
  const [confirmYear, setConfirmYear] = useState<number | null>(null)
  const [confirmEntry, setConfirmEntry] = useState<{ year: number; idx: number } | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), ok ? 2000 : 3500)
  }

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
      showToast(t.settings.actions.saved, true)
    } catch {
      setSaveStates((s) => ({ ...s, [year]: 'error' }))
      showToast(t.settings.actions.error, false)
    }
  }

  return (
    <section className={cardClass({ padding: 'none' })}>
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
              {confirmYear === pbYear.year ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{t.settings.actions.confirmQuestion}</span>
                  <button type="button" onClick={() => { removeYear(pbYear.year); setConfirmYear(null) }} className="font-medium text-destructive hover:text-destructive/70">
                    {t.settings.actions.confirmYes}
                  </button>
                  <button type="button" onClick={() => setConfirmYear(null)} className="text-muted-foreground hover:text-foreground">
                    {t.settings.actions.confirmCancel}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmYear(pbYear.year)}
                  className="text-xs text-destructive transition-colors hover:text-destructive/70"
                >
                  {t.settings.pbs.removeYear}
                </button>
              )}
            </div>

            <div className="space-y-2">
              {pbYear.entries.map((entry, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-1 items-center gap-2">
                      <select
                        value={entry.distance}
                        onChange={(e) => updateEntry(pbYear.year, idx, 'distance', e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                      >
                        {DISTANCES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <input
                        type="text"
                        placeholder={t.settings.pbs.placeholders.time}
                        defaultValue={secsToInput(entry.seconds)}
                        onBlur={(e) => updateEntry(pbYear.year, idx, 'seconds', e.target.value)}
                        className="w-20 shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                      />
                    </div>
                    {confirmEntry?.year === pbYear.year && confirmEntry?.idx === idx ? (
                      <span className="flex shrink-0 items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{t.settings.actions.confirmQuestion}</span>
                        <button type="button" onClick={() => { removeEntry(pbYear.year, idx); setConfirmEntry(null) }} className="font-medium text-destructive hover:text-destructive/70">
                          {t.settings.actions.confirmYes}
                        </button>
                        <button type="button" onClick={() => setConfirmEntry(null)} className="text-muted-foreground hover:text-foreground">
                          {t.settings.actions.confirmCancel}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmEntry({ year: pbYear.year, idx })}
                        className="shrink-0 text-xs text-destructive transition-colors hover:text-destructive/70"
                      >
                        {t.settings.pbs.removeEntry}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t.settings.pbs.activityId}</label>
                    <input
                      type="text"
                      value={entry.activityId}
                      onChange={(e) => updateEntry(pbYear.year, idx, 'activityId', e.target.value)}
                      className={inputCls}
                      placeholder={t.settings.pbs.placeholders.activityId}
                    />
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

      {toast && (
        <div className={cn(
          'fixed bottom-4 right-4 z-50 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg',
          toast.ok ? 'bg-emerald-600' : 'bg-red-500'
        )}>
          {toast.msg}
        </div>
      )}
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
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50',
        state === 'saved'  ? 'bg-green-500 hover:bg-green-600' :
        state === 'error'  ? 'bg-red-500 hover:bg-red-600'    :
        'bg-emerald-600 hover:bg-emerald-700'
      )}
    >
      {label}
    </button>
  )
}
