'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { getClientFirestore } from '@/lib/firebase'
import type { UpcomingRaceYear, UpcomingRace } from '@/application/usecases/GetGoalsData'
import { formatDuration, parseTimeInput } from '@/lib/formatters'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { cardClass } from '@/components/ui/Card'
import { SaveButton, type SaveState } from '@/components/ui/SaveButton'

type Toast = { msg: string; ok: boolean } | null

const DISTANCES = t.settings.pbs.distanceOptions as readonly string[]

function emptyRace(): UpcomingRace {
  return { date: '', name: '', distance: DISTANCES[0], location: '', url: '', targetSeconds: null }
}

function secsToInput(s: number | null | undefined): string {
  return s ? formatDuration(s) : ''
}

export function UpcomingRacesForm() {
  const currentYear = new Date().getFullYear()
  const [raceYears, setRaceYears] = useState<UpcomingRaceYear[]>([])
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({})
  const [toast, setToast] = useState<Toast>(null)
  const [confirmYear, setConfirmYear] = useState<number | null>(null)
  const [confirmRace, setConfirmRace] = useState<{ year: number; idx: number } | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), ok ? 2000 : 3500)
  }

  useEffect(() => {
    getDocs(collection(getClientFirestore(), 'upcomingRaces')).then((snap) => {
      setRaceYears(
        snap.docs.map((d) => d.data() as UpcomingRaceYear).sort((a, b) => b.year - a.year)
      )
    })
  }, [])

  function updateRace(year: number, idx: number, field: keyof UpcomingRace, value: string) {
    setRaceYears((prev) =>
      prev.map((ry) => {
        if (ry.year !== year) return ry
        const races = ry.races.map((r, i) => (i !== idx ? r : { ...r, [field]: value }))
        return { ...ry, races }
      })
    )
    setSaveStates((s) => ({ ...s, [year]: 'idle' }))
  }

  function updateTargetSeconds(year: number, idx: number, value: string) {
    const targetSeconds = value.trim() === '' ? null : parseTimeInput(value)
    setRaceYears((prev) =>
      prev.map((ry) => {
        if (ry.year !== year) return ry
        const races = ry.races.map((r, i) => (i !== idx ? r : { ...r, targetSeconds }))
        return { ...ry, races }
      })
    )
    setSaveStates((s) => ({ ...s, [year]: 'idle' }))
  }

  function addRace(year: number) {
    setRaceYears((prev) =>
      prev.map((ry) => (ry.year !== year ? ry : { ...ry, races: [...ry.races, emptyRace()] }))
    )
  }

  function addCurrentYearRace() {
    setRaceYears((prev) => {
      if (prev.some((ry) => ry.year === currentYear)) {
        return prev.map((ry) =>
          ry.year !== currentYear ? ry : { ...ry, races: [...ry.races, emptyRace()] }
        )
      }
      return [...prev, { year: currentYear, races: [emptyRace()] }].sort((a, b) => b.year - a.year)
    })
    setSaveStates((s) => ({ ...s, [currentYear]: 'idle' }))
  }

  function removeRace(year: number, idx: number) {
    setRaceYears((prev) =>
      prev.map((ry) => (ry.year !== year ? ry : { ...ry, races: ry.races.filter((_, i) => i !== idx) }))
    )
    setSaveStates((s) => ({ ...s, [year]: 'idle' }))
  }

  function addYear() {
    const next = (raceYears[0]?.year ?? new Date().getFullYear()) + 1
    setRaceYears((prev) => [{ year: next, races: [] }, ...prev])
  }

  function removeYear(year: number) {
    setRaceYears((prev) => prev.filter((ry) => ry.year !== year))
  }

  async function saveYear(year: number) {
    const raceYear = raceYears.find((ry) => ry.year === year)
    if (!raceYear) return
    setSaveStates((s) => ({ ...s, [year]: 'saving' }))
    try {
      await setDoc(doc(getClientFirestore(), 'upcomingRaces', String(year)), raceYear)
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
        <h2 className="text-sm font-semibold text-foreground">{t.settings.upcomingRaces.title}</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={addCurrentYearRace}
            className="text-xs font-medium text-accent-text transition-colors hover:text-accent-text/70"
          >
            + {t.settings.upcomingRaces.addCurrentYearRace(currentYear)}
          </button>
          <button
            type="button"
            onClick={addYear}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            + {t.settings.upcomingRaces.addYear}
          </button>
        </div>
      </div>

      <div className="divide-y divide-border">
        {raceYears.map((raceYear) => (
          <div key={raceYear.year} className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-foreground">{raceYear.year}</span>
              {confirmYear === raceYear.year ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{t.settings.actions.confirmQuestion}</span>
                  <button type="button" onClick={() => { removeYear(raceYear.year); setConfirmYear(null) }} className="font-medium text-destructive hover:text-destructive/70">
                    {t.settings.actions.confirmYes}
                  </button>
                  <button type="button" onClick={() => setConfirmYear(null)} className="text-muted-foreground hover:text-foreground">
                    {t.settings.actions.confirmCancel}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmYear(raceYear.year)}
                  className="text-xs text-destructive transition-colors hover:text-destructive/70"
                >
                  {t.settings.upcomingRaces.removeYear}
                </button>
              )}
            </div>

            <div className="space-y-2">
              {raceYear.races.map((race, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={race.date}
                      onChange={(e) => updateRace(raceYear.year, idx, 'date', e.target.value)}
                      className="w-36 shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent"
                    />
                    <select
                      value={race.distance}
                      onChange={(e) => updateRace(raceYear.year, idx, 'distance', e.target.value)}
                      className="w-32 shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent"
                    >
                      {DISTANCES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input
                      type="text"
                      placeholder={t.settings.upcomingRaces.placeholders.targetTime}
                      defaultValue={secsToInput(race.targetSeconds)}
                      onBlur={(e) => updateTargetSeconds(raceYear.year, idx, e.target.value)}
                      className="w-20 shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent"
                    />
                    {confirmRace?.year === raceYear.year && confirmRace?.idx === idx ? (
                      <span className="flex shrink-0 items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{t.settings.actions.confirmQuestion}</span>
                        <button type="button" onClick={() => { removeRace(raceYear.year, idx); setConfirmRace(null) }} className="font-medium text-destructive hover:text-destructive/70">
                          {t.settings.actions.confirmYes}
                        </button>
                        <button type="button" onClick={() => setConfirmRace(null)} className="text-muted-foreground hover:text-foreground">
                          {t.settings.actions.confirmCancel}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRace({ year: raceYear.year, idx })}
                        className="ml-auto shrink-0 text-xs text-destructive transition-colors hover:text-destructive/70"
                      >
                        {t.settings.upcomingRaces.removeRace}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder={t.settings.upcomingRaces.placeholders.name}
                    value={race.name}
                    onChange={(e) => updateRace(raceYear.year, idx, 'name', e.target.value)}
                    className={inputCls}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={t.settings.upcomingRaces.placeholders.location}
                      value={race.location ?? ''}
                      onChange={(e) => updateRace(raceYear.year, idx, 'location', e.target.value)}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      placeholder={t.settings.upcomingRaces.placeholders.url}
                      value={race.url ?? ''}
                      onChange={(e) => updateRace(raceYear.year, idx, 'url', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => addRace(raceYear.year)}
                className="text-xs font-medium text-accent-text transition-colors hover:text-accent-text/70"
              >
                + {t.settings.upcomingRaces.addRace}
              </button>
              <SaveButton state={saveStates[raceYear.year] ?? 'idle'} onClick={() => saveYear(raceYear.year)} />
            </div>
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
