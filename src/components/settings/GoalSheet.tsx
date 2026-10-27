'use client'

import { useState } from 'react'
import {
  validateGoalDraft,
  type DraftErrors,
  type GoalDraft,
  type GoalDraftField,
  type GoalTargetDraft,
  type GoalTargets,
} from '@/domain/goals/entries'
import { RACE_DISTANCES, type RaceDistanceKey } from '@/domain/race/distances'
import { saveGoalYear } from '@/lib/goalsRaces'
import { inputCls } from '@/lib/formStyles'
import { formatDuration } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Sheet } from '@/components/ui/Sheet'
import { SaveButton, type SaveState } from '@/components/ui/SaveButton'
import { t } from '@/i18n'
import { Field, errorText } from './RaceSheet'

interface Props {
  year: number
  annualKm: number
  targets: GoalTargets
  onClose: () => void
  onSaved: (message: string) => void
  onError: () => void
}

const KINDS: GoalTargetDraft['kind'][] = ['none', 'time', 'finish']

function goalDraftFrom(annualKm: number, targets: GoalTargets): GoalDraft {
  const entries = RACE_DISTANCES.map((key): [RaceDistanceKey, GoalTargetDraft] => {
    const target = targets[key]
    if (target === undefined) return [key, { kind: 'none' }]
    return [key, target === null ? { kind: 'finish' } : { kind: 'time', time: formatDuration(target) }]
  })
  return { annualKm: annualKm > 0 ? String(annualKm) : '', targets: Object.fromEntries(entries) as GoalDraft['targets'] }
}

export function GoalSheet({ year, annualKm, targets, onClose, onSaved, onError }: Props) {
  const s = t.settings.goalsRaces
  const [draft, setDraft] = useState<GoalDraft>(() => goalDraftFrom(annualKm, targets))
  const [errors, setErrors] = useState<DraftErrors<GoalDraftField>>({})
  const [state, setState] = useState<SaveState>('idle')
  const hasGoal = annualKm > 0 || Object.keys(targets).length > 0

  const setTarget = (key: RaceDistanceKey, target: GoalTargetDraft) =>
    setDraft((current) => ({ ...current, targets: { ...current.targets, [key]: target } }))

  async function write(entry: Parameters<typeof saveGoalYear>[0], message: string) {
    setState('saving')
    try {
      await saveGoalYear(entry)
      onSaved(message)
    } catch {
      setState('error')
      onError()
    }
  }

  function save() {
    const result = validateGoalDraft(draft)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    void write({ year, ...result.value }, s.saved)
  }

  return (
    <Sheet
      onClose={onClose}
      title={s.season(year)}
      titleId="goal-sheet-title"
      trailing={<SaveButton state={state} onClick={save} />}
      testId="goal-sheet"
    >
      <div className="flex flex-col gap-4 pt-3 pb-2">
        <Field label={s.fields.annualKm} error={errorText(errors.annualKm)} hint={s.fields.annualKmHint}>
          {(id, describedBy) => (
            <input
              id={id}
              type="text"
              inputMode="decimal"
              value={draft.annualKm}
              onChange={(e) => setDraft((current) => ({ ...current, annualKm: e.target.value }))}
              placeholder={s.fields.optional}
              aria-invalid={!!errors.annualKm}
              aria-describedby={describedBy}
              className={inputCls}
              data-testid="goal-annual-km"
            />
          )}
        </Field>

        {RACE_DISTANCES.map((key) => {
          const target = draft.targets[key]
          return (
            <Field key={key} label={t.records.distances[key]!} error={errorText(errors[key])}>
              {(id, describedBy) => (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.records.distances[key]}>
                    {KINDS.map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        aria-pressed={target.kind === kind}
                        className={cn(
                          'hit-44 inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium transition-colors',
                          target.kind === kind ? 'bg-accent text-accent-foreground' : 'bg-[var(--fill-3)] text-foreground'
                        )}
                        onClick={() => setTarget(key, kind === 'time' ? { kind, time: target.kind === 'time' ? target.time : '' } : { kind })}
                      >
                        {s.targetKind[kind]}
                      </button>
                    ))}
                  </div>
                  {target.kind === 'time' && (
                    <input
                      id={id}
                      type="text"
                      inputMode="numeric"
                      value={target.time}
                      onChange={(e) => setTarget(key, { kind: 'time', time: e.target.value })}
                      placeholder={s.fields.timePlaceholder}
                      aria-invalid={!!errors[key]}
                      aria-describedby={describedBy}
                      className={inputCls}
                      data-testid={`goal-time-${key}`}
                    />
                  )}
                </div>
              )}
            </Field>
          )
        })}

        {hasGoal && (
          <button
            type="button"
            onClick={() => void write({ year, removed: true }, s.removed)}
            disabled={state === 'saving'}
            className="hit-44 mt-1 self-start text-sm font-medium text-[var(--neg)] disabled:opacity-50"
            data-testid="goal-clear"
          >
            {s.clearGoals(year)}
          </button>
        )}
      </div>
    </Sheet>
  )
}
