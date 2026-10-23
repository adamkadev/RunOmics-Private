import {
  WEEK_REDUCTION_REASONS,
  type AdvisorPlanChange,
  type AdvisorRecommendation,
  type BootstrapWorkoutDraft,
  type CoachingPlanDraft,
  type WeekVolumeReduction,
} from '@/application/ports/CoachingAdvisor'
import { COACHING_SCHEMA_VERSION, type CoachEvidence, type TrainingWeek, type WorkoutPrescription } from '@/domain/coaching/types'
import {
  parseArray,
  parseCoachingPlan,
  parseEnumeration,
  parseIsoDate,
  parseObject,
  parseString,
  parseWorkoutPrescription,
} from '@/domain/coaching/validation'
import { MAX_BOOTSTRAP_WEEKS } from '@/domain/coaching/weekWindows'

/** Reads a coach's answer into the port's types; judging the plan is for application/coaching/draftRules.ts. */

const PLACEHOLDER_TIME = '2000-01-01T00:00:00.000Z'
const PLACEHOLDER_PROVENANCE = { source: 'gemini' as const, trigger: 'bootstrap' as const, createdAt: PLACEHOLDER_TIME }

type Trigger = 'bootstrap' | 'post_activity' | 'weekly_review'

function nameFields(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(raw.shortName === undefined || raw.shortName === null ? {} : { shortName: raw.shortName }),
    ...(raw.structure === undefined || raw.structure === null ? {} : { structure: raw.structure }),
  }
}

function bootstrapWorkoutDraft(value: unknown, label: string): BootstrapWorkoutDraft {
  const raw = parseObject(value, label)
  const parsed = parseWorkoutPrescription({
    id: 'structural-draft',
    revision: 1,
    date: raw.date,
    type: raw.type,
    title: raw.title,
    ...nameFields(raw),
    description: raw.description,
    status: 'prescribed',
    blocks: raw.blocks,
    ...(raw.notes === undefined ? {} : { notes: raw.notes }),
    provenance: PLACEHOLDER_PROVENANCE,
  }, label)
  return {
    date: parsed.date,
    type: parsed.type,
    title: parsed.title,
    ...(parsed.shortName ? { shortName: parsed.shortName } : {}),
    ...(parsed.structure ? { structure: parsed.structure } : {}),
    description: parsed.description,
    blocks: parsed.blocks,
    ...(parsed.notes ? { notes: parsed.notes } : {}),
  }
}

function weekReduction(value: unknown, label: string): WeekVolumeReduction | undefined {
  if (value === undefined || value === null) return undefined
  const raw = parseObject(value, label)
  return {
    reason: parseEnumeration(raw.reason, WEEK_REDUCTION_REASONS, `${label}.reason`),
    explanation: parseString(raw.explanation, `${label}.explanation`),
  }
}

export function parseBootstrapPlanDraft(value: unknown): CoachingPlanDraft {
  const raw = parseObject(value, 'plan')
  const weeks = parseArray(raw.weeks, 'plan.weeks', (value, label) => {
    const week = parseObject(value, label)
    const startDate = parseIsoDate(week.startDate, `${label}.startDate`)
    const endDate = parseIsoDate(week.endDate, `${label}.endDate`)
    if (startDate > endDate) throw new Error(`${label}: startDate must be <= endDate`)
    const workouts = parseArray(week.workouts, `${label}.workouts`, bootstrapWorkoutDraft)
    for (const workout of workouts) {
      if (workout.date < startDate || workout.date > endDate) throw new Error(`${label}: workout ${workout.date} falls outside its week`)
    }
    const reducedVolume = weekReduction(week.reducedVolume, `${label}.reducedVolume`)
    return {
      startDate,
      endDate,
      focus: parseString(week.focus, `${label}.focus`),
      ...(reducedVolume ? { reducedVolume } : {}),
      workouts,
    }
  })
  if (weeks.length === 0 || weeks.length > MAX_BOOTSTRAP_WEEKS) throw new Error(`plan.weeks must contain 1 to ${MAX_BOOTSTRAP_WEEKS} weeks`)
  return { name: parseString(raw.name, 'plan.name'), focus: parseString(raw.focus, 'plan.focus'), weeks }
}

function draftWorkout(value: unknown, trigger: Trigger): WorkoutPrescription {
  const { shortName, structure, ...raw } = parseObject(value, 'workout')
  return parseWorkoutPrescription({
    ...raw,
    ...nameFields({ shortName, structure }),
    id: typeof raw.id === 'string' && raw.id ? raw.id : 'draft-workout',
    revision: 1,
    status: 'prescribed',
    provenance: { ...PLACEHOLDER_PROVENANCE, trigger },
  })
}

function draftWeeks(value: unknown, trigger: Trigger): TrainingWeek[] {
  const rawWeeks = parseArray(value, 'weeks', parseObject).map((week, index) => ({
    ...week,
    id: typeof week.id === 'string' && week.id ? week.id : `draft-week-${index + 1}`,
    index: index + 1,
    workouts: parseArray(week.workouts, `weeks[${index}].workouts`, (workout) => draftWorkout(workout, trigger)),
  }))
  const first = rawWeeks[0] as { startDate?: unknown } | undefined
  const last = rawWeeks[rawWeeks.length - 1] as { endDate?: unknown } | undefined
  return parseCoachingPlan({
    schemaVersion: COACHING_SCHEMA_VERSION,
    id: 'draft-plan',
    revision: 1,
    status: 'active',
    block: {
      id: 'draft-block',
      name: 'Draft block',
      startDate: parseString(first?.startDate, 'first week startDate'),
      endDate: parseString(last?.endDate, 'last week endDate'),
      focus: 'Draft focus',
    },
    targetEvent: { id: 'draft-event', name: 'Draft event', date: '2099-01-01' },
    goal: { kind: 'finish', description: 'Draft goal' },
    weeks: rawWeeks,
    provenance: { ...PLACEHOLDER_PROVENANCE, trigger },
  }).weeks
}

function parseEvidence(value: unknown, label: string): CoachEvidence {
  const raw = parseObject(value, label)
  const rawValue = raw.value
  return {
    code: parseString(raw.code, `${label}.code`),
    message: parseString(raw.message, `${label}.message`),
    ...(typeof rawValue === 'string' || typeof rawValue === 'number' ? { value: rawValue } : {}),
    ...(typeof raw.unit === 'string' && raw.unit ? { unit: raw.unit } : {}),
  }
}

function planChange(value: unknown, label: string, trigger: Exclude<Trigger, 'bootstrap'>): AdvisorPlanChange {
  const change = parseObject(value, label)
  const kind = parseEnumeration(change.kind, ['upsert_workout', 'cancel_workout', 'replace_future'] as const, `${label}.kind`)
  if (kind === 'cancel_workout') return { kind, workoutId: parseString(change.workoutId, `${label}.workoutId`) }
  if (kind === 'upsert_workout') {
    return {
      kind,
      ...(typeof change.workoutId === 'string' && change.workoutId ? { workoutId: change.workoutId } : {}),
      workout: draftWorkout(change.workout, trigger),
    }
  }
  return { kind, effectiveDate: parseString(change.effectiveDate, `${label}.effectiveDate`), weeks: draftWeeks(change.weeks, trigger) }
}

export function parseRecommendation(value: unknown, trigger: Exclude<Trigger, 'bootstrap'>): AdvisorRecommendation {
  const raw = parseObject(value, 'recommendation')
  return {
    outcome: parseEnumeration(raw.outcome, ['KEEP', 'ADJUST', 'REPLAN'] as const, 'recommendation.outcome'),
    reasonCodes: parseArray(raw.reasonCodes, 'recommendation.reasonCodes', parseString),
    summary: parseString(raw.summary, 'recommendation.summary'),
    evidence: parseArray(raw.evidence, 'recommendation.evidence', parseEvidence),
    changes: parseArray(raw.changes, 'recommendation.changes', (change, label) => planChange(change, label, trigger)),
  }
}
