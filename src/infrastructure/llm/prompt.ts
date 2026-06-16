import type { InsightsInput } from './types'

// Shared prompt definition so every provider sends the same instructions and
// only differs in transport. Providers that support native structured output
// (Gemini responseSchema, OpenAI json_schema) should also pass JSON_SCHEMA.

export const SYSTEM_PROMPT = [
  'You are a running coach analyzing a single athlete\'s training data.',
  'You MUST reply with a single valid JSON object and nothing else.',
  'Never output prose, markdown, code fences, or explanations outside the JSON.',
  'Shape: {"insights": Insight[]} with at most 6 insights.',
  'Each Insight: {',
  '  "type": one of "training_load" | "performance_trend" | "vo2max" | "consistency" | "pacing_efficiency" | "injury_risk",',
  '  "title": short label (<= 60 chars),',
  '  "message": one concise, actionable sentence for the runner (<= 220 chars),',
  '  "severity": "low" | "medium" | "high",',
  '  "metrics": optional object of number values referenced in the message',
  '}.',
  'Rules:',
  '- Use ONLY the numbers provided in the data. Never invent values or fake precision.',
  '- If a metric is null, do not produce an insight that depends on it.',
  '- "high" severity is reserved for genuine injury/overreaching risk.',
  '- Prefer fewer, high-signal insights over filler. No generic motivation.',
].join('\n')

// JSON Schema reused by providers with native structured-output support.
export const JSON_SCHEMA = {
  type: 'object',
  properties: {
    insights: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'training_load',
              'performance_trend',
              'vo2max',
              'consistency',
              'pacing_efficiency',
              'injury_risk',
            ],
          },
          title: { type: 'string' },
          message: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          metrics: { type: 'object', additionalProperties: { type: 'number' } },
        },
        required: ['type', 'title', 'message', 'severity'],
      },
    },
  },
  required: ['insights'],
} as const

export function buildUserPrompt(input: InsightsInput): string {
  return [
    'Athlete training snapshot (JSON). Generate insights from this and only this:',
    JSON.stringify(input),
  ].join('\n')
}
