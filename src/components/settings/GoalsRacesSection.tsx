'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import type { GoalYear, UpcomingRace } from '@/domain/goals/types'
import { mergeGoals, mergeRaces, priorityOf, raceKey, targetsOf } from '@/domain/goals/entries'
import { readGoalsRacesEntries, type GoalsRacesEntries } from '@/lib/goalsRaces'
import { formatCountdown, formatDate, formatDuration, formatKm } from '@/lib/formatters'
import { DAY_MS } from '@/lib/calendarDate'
import { useToday } from '@/lib/useToday'
import { shortDist } from '@/components/goals/shortDistance'
import { t } from '@/i18n'
import { GROUP_CARD, GROUP_ROW } from './settingsGroup'
import { RaceSheet, type RaceTarget } from './RaceSheet'
import { GoalSheet } from './GoalSheet'

interface Props {
  syncedRaces: UpcomingRace[]
  writtenGoals: GoalYear[]
  today: string
  onSaved: (message: string, ok: boolean) => void
}

type Editing = { kind: 'race'; race: UpcomingRace | null } | { kind: 'goal'; year: number } | null

const ROW_BUTTON = `${GROUP_ROW} transition-colors hover:bg-[var(--surface-2)] active:bg-[var(--fill-4)]`

function targetOf(race: UpcomingRace): RaceTarget {
  return race.entryId ? { id: race.entryId } : { garminKey: raceKey(race) }
}

const targetsOfYear = (year: GoalYear | undefined) => (year ? targetsOf(year) : {})

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

function raceSummary(race: UpcomingRace): string {
  const s = t.settings.goalsRaces
  const goal = race.targetSeconds ? formatDuration(race.targetSeconds) : race.justFinish ? s.justFinish : null
  return [formatDate(race.date), shortDist(race.distance), goal].filter(Boolean).join(' · ')
}

function goalSummary(year: GoalYear | undefined): string {
  const s = t.settings.goalsRaces
  if (!year || (year.annualDistanceKm <= 0 && year.targets.length === 0)) return s.noGoal
  const parts = [
    year.annualDistanceKm > 0 ? s.annualKm(formatKm(year.annualDistanceKm)) : null,
    year.targets.length > 0 ? s.targetCount(year.targets.length) : null,
  ]
  return parts.filter(Boolean).join(' · ')
}

/** The years the editor offers: this one, the next, and any later one already set. */
function editableYears(goals: readonly GoalYear[], today: string): number[] {
  const current = Number(today.slice(0, 4))
  return [...new Set([current, current + 1, ...goals.map((goal) => goal.year).filter((year) => year > current)])].sort((a, b) => a - b)
}

export function GoalsRacesSection({ syncedRaces, writtenGoals, today: serverToday, onSaved }: Props) {
  const s = t.settings.goalsRaces
  const today = useToday(serverToday)
  const [entries, setEntries] = useState<GoalsRacesEntries | null>(null)
  const [failed, setFailed] = useState(false)
  const [editing, setEditing] = useState<Editing>(null)

  const [generation, setGeneration] = useState(0)
  const jumped = useRef(false)

  useEffect(() => {
    let alive = true
    readGoalsRacesEntries().then(
      (read) => { if (alive) setEntries(read) },
      () => { if (alive) setFailed(true) }
    )
    return () => { alive = false }
  }, [generation])

  function reload() {
    setFailed(false)
    setGeneration((current) => current + 1)
  }

  // The section mounts after the owner check, too late for the browser's own jump to a #goals-races link.
  useEffect(() => {
    if (!entries || jumped.current) return
    jumped.current = true
    if (window.location.hash === '#goals-races') document.getElementById('goals-races')?.scrollIntoView()
  }, [entries])

  const races = useMemo(
    () => (entries ? mergeRaces(syncedRaces, entries.races).filter((race) => race.date >= today) : []),
    [entries, syncedRaces, today]
  )
  const goals = useMemo(() => (entries ? mergeGoals(writtenGoals, entries.goals) : []), [entries, writtenGoals])

  function saved(message: string) {
    setEditing(null)
    onSaved(message, true)
    reload()
  }

  if (failed) {
    return (
      <div className={`${GROUP_CARD} flex items-center justify-between gap-3 px-4 py-3`} data-testid="goals-races-error">
        <p className="text-sm text-muted-foreground">{s.loadFailed}</p>
        <button type="button" onClick={reload} className="hit-44 text-sm font-medium text-accent-text">{s.retry}</button>
      </div>
    )
  }

  if (!entries) {
    return <div className={`${GROUP_CARD} px-4 py-3 text-sm text-muted-foreground`}>{s.loading}</div>
  }

  return (
    <>
      <div className={GROUP_CARD} data-testid="races-editor">
        {races.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground" data-testid="races-empty">{s.noRace}</p>}
        {races.map((race) => {
          const days = daysBetween(today, race.date)
          return (
            <button
              key={raceKey(race)}
              type="button"
              className={ROW_BUTTON}
              onClick={() => setEditing({ kind: 'race', race })}
              data-testid="race-row"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--fill-3)] text-[13px] font-semibold text-accent-text"
                  aria-hidden
                >
                  {priorityOf(race)}
                </span>
                <span className="sr-only">{s.priorityName(priorityOf(race))}</span>
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{race.name}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{raceSummary(race)}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted-foreground">
                {days >= 0 && <span className="tabular-nums">{formatCountdown(days)}</span>}
                <ChevronRight size={16} aria-hidden className="text-subtle" />
              </span>
            </button>
          )
        })}
        <button
          type="button"
          className={`${ROW_BUTTON} justify-start text-accent-text`}
          onClick={() => setEditing({ kind: 'race', race: null })}
          data-testid="race-add"
        >
          <Plus size={18} aria-hidden />
          <span>{s.addRace}</span>
        </button>
      </div>

      <div className={GROUP_CARD} data-testid="goals-editor">
        {editableYears(goals, today).map((year) => (
          <button key={year} type="button" className={ROW_BUTTON} onClick={() => setEditing({ kind: 'goal', year })} data-testid={`goal-row-${year}`}>
            <span className="text-foreground">{s.season(year)}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-[15px] text-muted-foreground">
              <span className="truncate">{goalSummary(goals.find((goal) => goal.year === year))}</span>
              <ChevronRight size={16} aria-hidden className="shrink-0 text-subtle" />
            </span>
          </button>
        ))}
      </div>
      <p className="px-1 text-[13px] leading-[18px] text-muted-foreground">{s.whenApplied}</p>

      {editing?.kind === 'race' && (
        <RaceSheet
          race={editing.race}
          target={editing.race ? targetOf(editing.race) : {}}
          today={today}
          onClose={() => setEditing(null)}
          onSaved={saved}
          onError={() => onSaved(s.saveFailed, false)}
        />
      )}
      {editing?.kind === 'goal' && (
        <GoalSheet
          year={editing.year}
          targets={targetsOfYear(goals.find((goal) => goal.year === editing.year))}
          annualKm={goals.find((goal) => goal.year === editing.year)?.annualDistanceKm ?? 0}
          onClose={() => setEditing(null)}
          onSaved={saved}
          onError={() => onSaved(s.saveFailed, false)}
        />
      )}
    </>
  )
}
