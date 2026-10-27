'use client'

import { useId, useState, type ReactNode } from 'react'
import type { RacePriority, UpcomingRace } from '@/domain/goals/types'
import {
  ENTRY_LIMITS,
  RACE_PRIORITIES,
  priorityOf,
  raceDistanceKm,
  validateRaceDraft,
  type DraftErrors,
  type RaceDraft,
  type RaceDraftError,
  type RaceDraftField,
} from '@/domain/goals/entries'
import { RACE_DISTANCES, RACE_DISTANCE_KM } from '@/domain/race/distances'
import { removeRace, saveRace } from '@/lib/goalsRaces'
import { inputCls } from '@/lib/formStyles'
import { formatDuration } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Sheet } from '@/components/ui/Sheet'
import { SaveButton, type SaveState } from '@/components/ui/SaveButton'
import { t } from '@/i18n'

export interface RaceTarget {
  id?: string
  garminKey?: string
}

interface Props {
  race: UpcomingRace | null
  target: RaceTarget
  today: string
  onClose: () => void
  onSaved: (message: string) => void
  onError: () => void
}

const CHIP = 'hit-44 inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium transition-colors'
const chipClass = (on: boolean) => cn(CHIP, on ? 'bg-accent text-accent-foreground' : 'bg-[var(--fill-3)] text-foreground')

function draftFrom(race: UpcomingRace | null): RaceDraft {
  if (!race) return { name: '', date: '', distanceKm: '', justFinish: false, time: '', priority: 'B', location: '' }
  const km = raceDistanceKm(race)
  return {
    name: race.name,
    date: race.date,
    distanceKm: km === null ? '' : String(km),
    justFinish: !race.targetSeconds,
    time: race.targetSeconds ? formatDuration(race.targetSeconds) : '',
    priority: priorityOf(race),
    location: race.location ?? '',
  }
}

export function errorText(error: RaceDraftError | undefined): string | null {
  return error ? t.settings.goalsRaces.errors[error] : null
}

export function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-muted-foreground">{label}</label>
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-[var(--neg)]" data-testid="field-error">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

export function RaceSheet({ race, target, today, onClose, onSaved, onError }: Props) {
  const s = t.settings.goalsRaces
  const [draft, setDraft] = useState<RaceDraft>(() => draftFrom(race))
  const [errors, setErrors] = useState<DraftErrors<RaceDraftField>>({})
  const [state, setState] = useState<SaveState>('idle')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const standardKm = RACE_DISTANCES.map((key) => String(RACE_DISTANCE_KM[key]))
  const [otherDistance, setOtherDistance] = useState(() => draft.distanceKm !== '' && !standardKm.includes(draft.distanceKm))
  const set = <K extends keyof RaceDraft>(key: K, value: RaceDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  async function save() {
    const result = validateRaceDraft(draft, { today, savedDate: race?.date })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setState('saving')
    try {
      await saveRace(result.value, target)
      onSaved(race ? s.saved : s.added)
    } catch {
      setState('error')
      onError()
    }
  }

  async function remove() {
    if (!confirmRemove) {
      setConfirmRemove(true)
      return
    }
    setState('saving')
    try {
      await removeRace(target)
      onSaved(s.removed)
    } catch {
      setState('error')
      onError()
    }
  }

  return (
    <Sheet
      onClose={onClose}
      title={race ? s.editRace : s.addRace}
      titleId="race-sheet-title"
      trailing={<SaveButton state={state} onClick={save} />}
      testId="race-sheet"
    >
      <div className="flex flex-col gap-4 pt-3 pb-2">
        <Field label={s.fields.name} error={errorText(errors.name)}>
          {(id, describedBy) => (
            <input
              id={id}
              type="text"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={ENTRY_LIMITS.nameMax}
              placeholder={s.fields.namePlaceholder}
              aria-invalid={!!errors.name}
              aria-describedby={describedBy}
              className={inputCls}
              data-testid="race-name"
            />
          )}
        </Field>

        <Field label={s.fields.date} error={errorText(errors.date)}>
          {(id, describedBy) => (
            <input
              id={id}
              type="date"
              value={draft.date}
              min={race?.date && race.date < today ? race.date : today}
              onChange={(e) => set('date', e.target.value)}
              aria-invalid={!!errors.date}
              aria-describedby={describedBy}
              className={inputCls}
              data-testid="race-date"
            />
          )}
        </Field>

        <Field label={s.fields.distance} error={errorText(errors.distance)} hint={otherDistance ? s.fields.distanceHint : undefined}>
          {(id, describedBy) => (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={s.fields.distance}>
                {RACE_DISTANCES.map((key) => {
                  const km = String(RACE_DISTANCE_KM[key])
                  const on = !otherDistance && draft.distanceKm === km
                  return (
                    <button key={key} type="button" aria-pressed={on} className={chipClass(on)} onClick={() => { setOtherDistance(false); set('distanceKm', km) }}>
                      {t.records.distances[key]}
                    </button>
                  )
                })}
                <button type="button" aria-pressed={otherDistance} className={chipClass(otherDistance)} onClick={() => { setOtherDistance(true); set('distanceKm', '') }}>
                  {s.fields.otherDistance}
                </button>
              </div>
              {otherDistance && (
                <input
                  id={id}
                  type="text"
                  inputMode="decimal"
                  value={draft.distanceKm}
                  onChange={(e) => set('distanceKm', e.target.value)}
                  placeholder={s.fields.kmPlaceholder}
                  aria-invalid={!!errors.distance}
                  aria-describedby={describedBy}
                  className={inputCls}
                  data-testid="race-km"
                />
              )}
            </div>
          )}
        </Field>

        <Field label={s.fields.goal} error={errorText(errors.time)} hint={draft.justFinish ? undefined : s.fields.timeHint}>
          {(id, describedBy) => (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={s.fields.goal}>
                <button type="button" aria-pressed={!draft.justFinish} className={chipClass(!draft.justFinish)} onClick={() => set('justFinish', false)}>
                  {s.fields.timeGoal}
                </button>
                <button type="button" aria-pressed={draft.justFinish} className={chipClass(draft.justFinish)} onClick={() => set('justFinish', true)} data-testid="race-just-finish">
                  {s.justFinish}
                </button>
              </div>
              {!draft.justFinish && (
                <input
                  id={id}
                  type="text"
                  inputMode="numeric"
                  value={draft.time}
                  onChange={(e) => set('time', e.target.value)}
                  placeholder={s.fields.timePlaceholder}
                  aria-invalid={!!errors.time}
                  aria-describedby={describedBy}
                  className={inputCls}
                  data-testid="race-time"
                />
              )}
            </div>
          )}
        </Field>

        <Field label={s.fields.priority} hint={s.priorityHint[draft.priority]}>
          {() => (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={s.fields.priority}>
              {RACE_PRIORITIES.map((priority: RacePriority) => (
                <button
                  key={priority}
                  type="button"
                  aria-pressed={draft.priority === priority}
                  aria-label={s.priorityName(priority)}
                  className={cn(chipClass(draft.priority === priority), 'min-w-11 justify-center')}
                  onClick={() => set('priority', priority)}
                >
                  {priority}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label={s.fields.location}>
          {(id) => (
            <input
              id={id}
              type="text"
              value={draft.location}
              onChange={(e) => set('location', e.target.value)}
              maxLength={ENTRY_LIMITS.locationMax}
              placeholder={s.fields.optional}
              className={inputCls}
            />
          )}
        </Field>

        {race && (
          <button
            type="button"
            onClick={remove}
            disabled={state === 'saving'}
            className="hit-44 mt-1 self-start text-sm font-medium text-[var(--neg)] disabled:opacity-50"
            data-testid="race-remove"
          >
            {confirmRemove ? s.confirmRemove : target.garminKey ? s.hideGarminRace : s.removeRace}
          </button>
        )}
      </div>
    </Sheet>
  )
}
