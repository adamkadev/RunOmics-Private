'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { PbYear, PbEntry } from '@/application/usecases/GetGoalsData'
import { formatDuration, parseTimeInput } from '@/lib/formatters'
import { inputCls } from '@/lib/formStyles'
import { t } from '@/i18n'
import { cardClass } from '@/components/ui/Card'
import { SaveButton, type SaveState } from '@/components/ui/SaveButton'
import { Toast, useToast } from '@/components/ui/Toast'
import { ConfirmDelete } from '@/components/ui/ConfirmDelete'
import { AddButton } from '@/components/ui/AddButton'

const DISTANCES = t.settings.pbs.distanceOptions as readonly string[]

function secsToInput(s: number): string {
  return s > 0 ? formatDuration(s) : ''
}

export function PbsForm() {
  const [pbYears, setPbYears] = useState<PbYear[]>([])
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({})
  const { toast, showToast } = useToast()
  const [confirmYear, setConfirmYear] = useState<number | null>(null)
  const [confirmEntry, setConfirmEntry] = useState<{ year: number; idx: number } | null>(null)

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
        <AddButton label={t.settings.pbs.addYear} onClick={addYear} />
      </div>

      <div className="divide-y divide-border">
        {pbYears.map((pbYear) => (
          <div key={pbYear.year} className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-foreground">{pbYear.year}</span>
              <ConfirmDelete
                confirming={confirmYear === pbYear.year}
                onRequestConfirm={() => setConfirmYear(pbYear.year)}
                onConfirm={() => { removeYear(pbYear.year); setConfirmYear(null) }}
                onCancel={() => setConfirmYear(null)}
                label={t.settings.pbs.removeYear}
              />
            </div>

            <div className="space-y-2">
              {pbYear.entries.map((entry, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-1 items-center gap-2">
                      <select
                        value={entry.distance}
                        onChange={(e) => updateEntry(pbYear.year, idx, 'distance', e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent"
                      >
                        {DISTANCES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <input
                        type="text"
                        placeholder={t.settings.pbs.placeholders.time}
                        defaultValue={secsToInput(entry.seconds)}
                        onBlur={(e) => updateEntry(pbYear.year, idx, 'seconds', e.target.value)}
                        className="w-20 shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent"
                      />
                    </div>
                    <ConfirmDelete
                      confirming={confirmEntry?.year === pbYear.year && confirmEntry?.idx === idx}
                      onRequestConfirm={() => setConfirmEntry({ year: pbYear.year, idx })}
                      onConfirm={() => { removeEntry(pbYear.year, idx); setConfirmEntry(null) }}
                      onCancel={() => setConfirmEntry(null)}
                      label={t.settings.pbs.removeEntry}
                    />
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
              <AddButton label={t.settings.pbs.addEntry} onClick={() => addEntry(pbYear.year)} />
              <SaveButton state={saveStates[pbYear.year] ?? 'idle'} onClick={() => saveYear(pbYear.year)} />
            </div>
          </div>
        ))}
      </div>

      <Toast toast={toast} />
    </section>
  )
}
