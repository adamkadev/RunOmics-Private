'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'
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

function yearOf(race: UpcomingRace, fallback: number): number {
  const year = race.date ? new Date(race.date).getFullYear() : NaN
  return Number.isFinite(year) ? year : fallback
}

export function UpcomingRacesForm() {
  const currentYear = new Date().getFullYear()
  const [races, setRaces] = useState<UpcomingRace[]>([])
  const [loadedYears, setLoadedYears] = useState<number[]>([])
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [toast, setToast] = useState<Toast>(null)
  const [confirmRace, setConfirmRace] = useState<number | null>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), ok ? 2000 : 3500)
  }

  useEffect(() => {
    getDocs(collection(getClientFirestore(), 'upcomingRaces')).then((snap) => {
      const raceYears = snap.docs.map((d) => d.data() as UpcomingRaceYear)
      setLoadedYears(raceYears.map((ry) => ry.year))
      setRaces(raceYears.flatMap((ry) => ry.races))
    })
  }, [])

  const groups = useMemo(() => {
    const byYear = new Map<number, { race: UpcomingRace; idx: number }[]>()
    races.forEach((race, idx) => {
      const year = yearOf(race, currentYear)
      const entries = byYear.get(year) ?? []
      entries.push({ race, idx })
      byYear.set(year, entries)
    })
    return Array.from(byYear.entries())
      .map(([year, entries]) => ({
        year,
        entries: entries.slice().sort((a, b) => a.race.date.localeCompare(b.race.date)),
      }))
      .sort((a, b) => b.year - a.year)
  }, [races, currentYear])

  function updateRace(idx: number, field: keyof UpcomingRace, value: string) {
    setRaces((prev) => prev.map((r, i) => (i !== idx ? r : { ...r, [field]: value })))
    setSaveState('idle')
  }

  function updateTargetSeconds(idx: number, value: string) {
    const targetSeconds = value.trim() === '' ? null : parseTimeInput(value)
    setRaces((prev) => prev.map((r, i) => (i !== idx ? r : { ...r, targetSeconds })))
    setSaveState('idle')
  }

  function addRace() {
    setRaces((prev) => [...prev, emptyRace()])
  }

  function removeRace(idx: number) {
    setRaces((prev) => prev.filter((_, i) => i !== idx))
    setConfirmRace(null)
    setSaveState('idle')
  }

  async function saveAll() {
    setSaveState('saving')
    try {
      const currentYears = new Set(groups.map((g) => g.year))
      const db = getClientFirestore()
      await Promise.all([
        ...groups.map((g) =>
          setDoc(doc(db, 'upcomingRaces', String(g.year)), {
            year: g.year,
            races: g.entries.map((e) => e.race),
          })
        ),
        ...loadedYears
          .filter((year) => !currentYears.has(year))
          .map((year) => deleteDoc(doc(db, 'upcomingRaces', String(year)))),
      ])
      setLoadedYears(groups.map((g) => g.year))
      setSaveState('saved')
      showToast(t.settings.actions.saved, true)
    } catch {
      setSaveState('error')
      showToast(t.settings.actions.error, false)
    }
  }

  return (
    <section className={cardClass({ padding: 'none' })}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{t.settings.upcomingRaces.title}</h2>
        <button
          type="button"
          onClick={addRace}
          className="text-xs font-medium text-accent-text transition-colors hover:text-accent-text/70"
        >
          + {t.settings.upcomingRaces.addRace}
        </button>
      </div>

      <div className="divide-y divide-border">
        {groups.map((group) => (
          <div key={group.year} className="p-4 sm:p-5 space-y-3">
            <span className="text-base font-bold text-foreground">{group.year}</span>

            <div className="space-y-2">
              {group.entries.map(({ race, idx }) => (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={race.date}
                      onChange={(e) => updateRace(idx, 'date', e.target.value)}
                      className="w-36 shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent"
                    />
                    <select
                      value={race.distance}
                      onChange={(e) => updateRace(idx, 'distance', e.target.value)}
                      className="w-32 shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent"
                    >
                      {DISTANCES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input
                      type="text"
                      placeholder={t.settings.upcomingRaces.placeholders.targetTime}
                      defaultValue={secsToInput(race.targetSeconds)}
                      onBlur={(e) => updateTargetSeconds(idx, e.target.value)}
                      className="w-20 shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent"
                    />
                    {confirmRace === idx ? (
                      <span className="flex shrink-0 items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{t.settings.actions.confirmQuestion}</span>
                        <button type="button" onClick={() => removeRace(idx)} className="font-medium text-destructive hover:text-destructive/70">
                          {t.settings.actions.confirmYes}
                        </button>
                        <button type="button" onClick={() => setConfirmRace(null)} className="text-muted-foreground hover:text-foreground">
                          {t.settings.actions.confirmCancel}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRace(idx)}
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
                    onChange={(e) => updateRace(idx, 'name', e.target.value)}
                    className={inputCls}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={t.settings.upcomingRaces.placeholders.location}
                      value={race.location ?? ''}
                      onChange={(e) => updateRace(idx, 'location', e.target.value)}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      placeholder={t.settings.upcomingRaces.placeholders.url}
                      value={race.url ?? ''}
                      onChange={(e) => updateRace(idx, 'url', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-border px-4 py-3 sm:px-5">
        <SaveButton state={saveState} onClick={saveAll} />
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
