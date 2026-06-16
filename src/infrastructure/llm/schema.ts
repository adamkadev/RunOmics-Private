import type { Insight, InsightSeverity, InsightType, InsightsOutput } from './types'

// Hand-rolled strict validation (the project ships no validation library).
// Anything that does not match the contract is dropped; a fully invalid payload
// returns null so the caller can fall back to deterministic insights.

const INSIGHT_TYPES: readonly InsightType[] = [
  'training_load',
  'performance_trend',
  'vo2max',
  'consistency',
  'pacing_efficiency',
  'injury_risk',
]

const SEVERITIES: readonly InsightSeverity[] = ['low', 'medium', 'high']

const MAX_INSIGHTS = 6
const MAX_TITLE = 80
const MAX_MESSAGE = 280

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed.slice(0, max) : null
}

function cleanMetrics(value: unknown): Record<string, number> | undefined {
  if (!isObject(value)) return undefined
  const out: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) out[key] = raw
  }
  return Object.keys(out).length ? out : undefined
}

function parseInsight(value: unknown): Insight | null {
  if (!isObject(value)) return null

  const type = value.type
  if (typeof type !== 'string' || !INSIGHT_TYPES.includes(type as InsightType)) return null

  const severity = value.severity
  if (typeof severity !== 'string' || !SEVERITIES.includes(severity as InsightSeverity)) return null

  const title = cleanString(value.title, MAX_TITLE)
  const message = cleanString(value.message, MAX_MESSAGE)
  if (!title || !message) return null

  const metrics = cleanMetrics(value.metrics)

  return {
    type: type as InsightType,
    severity: severity as InsightSeverity,
    title,
    message,
    ...(metrics ? { metrics } : {}),
  }
}

// Accepts the raw provider payload (already JSON-parsed). Returns a validated
// InsightsOutput, or null when nothing usable could be extracted.
export function parseInsightsOutput(raw: unknown): InsightsOutput | null {
  const list = isObject(raw) ? raw.insights : raw
  if (!Array.isArray(list)) return null

  const insights = list
    .map(parseInsight)
    .filter((i): i is Insight => i !== null)
    .slice(0, MAX_INSIGHTS)

  return insights.length ? { insights } : null
}

// Tolerant JSON extraction: providers occasionally wrap JSON in prose or code
// fences despite instructions. Pull the outermost object/array and parse it.
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.search(/[[{]/)
    const end = Math.max(trimmed.lastIndexOf(']'), trimmed.lastIndexOf('}'))
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }
}
