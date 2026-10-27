import type { WorkoutStep } from '@/domain/activity/types'

export type { WorkoutStep, WorkoutStepKind } from '@/domain/activity/types'

const DEFAULT_WARMUP_MIN = 15
const DEFAULT_COOLDOWN_MIN = 10
const DEFAULT_RECOVERY_MIN = 2
const MIN_BOOKEND_MIN = 5

const REPS_WITH_RECOVERY = /(\d+)\s*[x×]\s*\(\s*(\d+)\s*['’]\s*\/\s*(\d+)\s*['’]\s*\)/i
const REPS_SIMPLE = /(\d+)\s*[x×]\s*(\d+)\s*['’]/i
const TOTAL_WITH_ACTIVE = /(\d+)\s*['’]\s*dont\s+(\d+)\s*['’]/i

export function bookends(totalMin: number | null, workMin: number): { warmup: number; cooldown: number } {
  if (totalMin === null || totalMin <= workMin + 2 * MIN_BOOKEND_MIN) {
    return { warmup: DEFAULT_WARMUP_MIN, cooldown: DEFAULT_COOLDOWN_MIN }
  }
  const remaining = totalMin - workMin
  const warmup = Math.round(remaining * 0.55)
  return { warmup, cooldown: remaining - warmup }
}

export function parseWorkoutStructure(name: string, durationSecs?: number): WorkoutStep[] | null {
  const totalMin = durationSecs ? Math.round(durationSecs / 60) : null

  const withRecovery = name.match(REPS_WITH_RECOVERY)
  const simple = withRecovery ? null : name.match(REPS_SIMPLE)
  const totalActive = withRecovery || simple ? null : name.match(TOTAL_WITH_ACTIVE)

  if (withRecovery) {
    const reps = Number(withRecovery[1])
    const effortMin = Number(withRecovery[2])
    const recoveryMin = Number(withRecovery[3])
    if (!reps || reps > 30) return null
    const workMin = reps * effortMin + (reps - 1) * recoveryMin
    const { warmup, cooldown } = bookends(totalMin, workMin)
    const steps: WorkoutStep[] = [{ kind: 'warmup', minutes: warmup }]
    for (let i = 1; i <= reps; i++) {
      steps.push({ kind: 'effort', minutes: effortMin, rep: i })
      if (i < reps) steps.push({ kind: 'recovery', minutes: recoveryMin })
    }
    steps.push({ kind: 'cooldown', minutes: cooldown })
    return steps
  }

  if (simple) {
    const reps = Number(simple[1])
    const effortMin = Number(simple[2])
    if (!reps || reps > 30 || !effortMin) return null
    const workMin = reps * effortMin + (reps - 1) * DEFAULT_RECOVERY_MIN
    const { warmup, cooldown } = bookends(totalMin, workMin)
    const steps: WorkoutStep[] = [{ kind: 'warmup', minutes: warmup }]
    for (let i = 1; i <= reps; i++) {
      steps.push({ kind: 'effort', minutes: effortMin, rep: i })
      if (i < reps) steps.push({ kind: 'recovery', minutes: DEFAULT_RECOVERY_MIN })
    }
    steps.push({ kind: 'cooldown', minutes: cooldown })
    return steps
  }

  if (totalActive) {
    const total = Number(totalActive[1])
    const active = Number(totalActive[2])
    if (!total || !active || active >= total) return null
    const remaining = total - active
    const warmup = Math.round(remaining * 0.55)
    return [
      { kind: 'warmup', minutes: warmup },
      { kind: 'effort', minutes: active, rep: 1 },
      { kind: 'cooldown', minutes: remaining - warmup },
    ]
  }

  return null
}
