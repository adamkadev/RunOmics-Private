import type { WorkoutStep } from '@/domain/activity/types'
import { formatClock } from '@/lib/formatters'
import { t } from '@/i18n'
import type { SessionKind } from './sessionKind'
import { isWalk } from './workoutSteps'
import { sessionParts, stepSeconds } from './workoutSummary'

export interface WatchAlerts {
  /** As a Forerunner 55's own Run/Walk alert takes it: one run time and one walk time. */
  runWalk: { runSeconds: number; walkSeconds: number } | null
  pace: [number, number] | null
}

const same = (values: readonly number[]) => values.length > 0 && values.every((value) => value === values[0])

export function watchAlerts(steps: readonly WorkoutStep[] | null, kind: SessionKind): WatchAlerts | null {
  const list = [...(steps ?? [])]
  const { body, strides } = sessionParts(list)
  const running = strides ? [body!] : list.filter((step) => step.kind === 'effort')
  const walks = list.filter((step) => step.kind === 'recovery')
  const runWalkSession = kind === 'easy' && !strides && running.length > 1 && walks.length > 0 && walks.every((step) => isWalk(step, true))
  const runSeconds = running.map(stepSeconds)
  const walkSeconds = walks.map(stepSeconds)
  const runWalk = runWalkSession && same(runSeconds) && same(walkSeconds) && runSeconds[0]! > 0 && walkSeconds[0]! > 0
    ? { runSeconds: runSeconds[0]!, walkSeconds: walkSeconds[0]! }
    : null

  const ranges = running.map((step) => step.paceSecPerKm)
  const first = ranges[0]
  const pace = first && ranges.every((range) => range && range[0] === first[0] && range[1] === first[1]) ? first : null
  if (!runWalk && !pace) return null
  return { runWalk, pace }
}

export function watchAlertsLine({ runWalk, pace }: WatchAlerts): string {
  const s = t.plan.session
  return [
    runWalk ? s.runWalkAlert(formatClock(runWalk.runSeconds), formatClock(runWalk.walkSeconds)) : null,
    pace ? s.paceAlert(`${formatClock(pace[0])}–${formatClock(pace[1])} ${t.units.perKm}`) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
