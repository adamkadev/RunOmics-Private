import type {
  PlanConfidence,
  PlanOutput,
  PlanSession,
  SessionKind,
  TrainingPlan,
} from './types'

// Hand-rolled strict validation (no validation library in the project). A fully
// invalid payload returns null so the caller falls back to a deterministic plan.

const SESSION_KINDS: readonly SessionKind[] = [
  'Sprint',
  'Anaerobic',
  'VO2Max',
  'Threshold',
  'Tempo',
  'Base',
  'Race',
  'rest',
  'cross_training',
]

const CONFIDENCES: readonly PlanConfidence[] = ['low', 'medium', 'high']
const DEFAULT_CONFIDENCE: PlanConfidence = 'medium'

const MAX_SESSIONS = 7
const MAX_SHORT = 80
const MAX_LONG = 280

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed.slice(0, max) : null
}

function cleanNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseSession(value: unknown): PlanSession | null {
  if (!isObject(value)) return null

  const kind = value.kind
  if (typeof kind !== 'string' || !SESSION_KINDS.includes(kind as SessionKind)) return null

  const day = cleanString(value.day, MAX_SHORT)
  const title = cleanString(value.title, MAX_SHORT)
  const description = cleanString(value.description, MAX_LONG)
  if (!day || !title || !description) return null

  return {
    day,
    kind: kind as SessionKind,
    title,
    description,
    distanceKm: cleanNumber(value.distanceKm),
    targetPace: cleanString(value.targetPace, MAX_SHORT),
    ...(value.completed === true ? { completed: true } : {}),
  }
}

function parsePlan(value: unknown): TrainingPlan | null {
  if (!isObject(value)) return null

  const focus = cleanString(value.focus, MAX_SHORT)
  const rationale = cleanString(value.rationale, MAX_LONG)
  const targetWeeklyKm = cleanNumber(value.targetWeeklyKm)
  if (!focus || !rationale || targetWeeklyKm === null) return null

  if (!Array.isArray(value.sessions)) return null
  const sessions = value.sessions
    .map(parseSession)
    .filter((s): s is PlanSession => s !== null)
    .slice(0, MAX_SESSIONS)
  if (!sessions.length) return null

  const confidence = CONFIDENCES.includes(value.confidence as PlanConfidence)
    ? (value.confidence as PlanConfidence)
    : DEFAULT_CONFIDENCE

  return {
    focus,
    rationale,
    targetWeeklyKm: Math.round(targetWeeklyKm),
    keyWorkout: cleanString(value.keyWorkout, MAX_SHORT),
    sessions,
    confidence,
  }
}

export function parsePlanOutput(raw: unknown): PlanOutput | null {
  const planValue = isObject(raw) ? raw.plan : raw
  const plan = parsePlan(planValue)
  return plan ? { plan } : null
}
