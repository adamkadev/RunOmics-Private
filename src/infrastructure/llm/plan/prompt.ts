import type { PlanInput } from './types'

// System prompt + schema for the training-plan request. The model proposes ONE
// representative training week grounded in the athlete's real data and goal.

export const PLAN_SYSTEM_PROMPT = [
  'You are an experienced running coach building this week\'s training for a single',
  'athlete, grounded ONLY in the data provided. You never invent races, paces, or',
  'history that are not in the input.',
  'You MUST reply with a single valid JSON object and nothing else - no prose, no',
  'markdown, no code fences.',
  'Shape: {"plan": {',
  '  "focus": short phrase for this block\'s focus (e.g. "Aerobic base"),',
  '  "rationale": 1-2 sentences explaining the plan from the data + goal,',
  '  "targetWeeklyKm": number,',
  '  "keyWorkout": the single priority session this week (or null),',
  '  "sessions": Session[] for ONE representative week (one entry per day, 7 entries),',
  '  "confidence": "low" | "medium" | "high"',
  '}}.',
  'Session: {',
  '  "day": "Monday".."Sunday",',
  '  "kind": "rest" | "recovery" | "easy" | "long" | "tempo" | "threshold" | "intervals" | "race_pace" | "cross_training",',
  '  "title": short label,',
  '  "description": what to do, concise and actionable,',
  '  "distanceKm": number or null (null for rest),',
  '  "targetPace": pace string like "5:20 /km" or null',
  '}.',
  'Rules:',
  '- Build the week around targetWeeklyKm. Reconcile the athlete\'s recentWeeklyKm with',
  '  goal.projection.weeklyNeeded, but NEVER jump weekly volume more than ~10% above',
  '  recentWeeklyKm (injury safety), even if the goal would need more - flag the gap',
  '  in the rationale instead.',
  '- Respect current fatigue: if trainingStatus.risk is "high" or status is',
  '  "overreaching", make this a recovery/deload week (lower volume, no hard sessions).',
  '- Honour the 80/20 easy:hard balance: most volume easy, at most 1-2 quality sessions.',
  '- Use paceZones for targetPace when prescribing a paced session; if paceZones is',
  '  empty, set targetPace to null.',
  '- Prescribe sessions that move the athlete toward goal.targets (e.g. include race_pace',
  '  work for a target distance) without overreaching.',
  '- "confidence": "high" when recentWeeklyKm and consistency are solid and the plan is a',
  '  modest adjustment; "low" when data is thin or the goal gap is large. Never a number.',
  '- Always include rest or recovery days. Do not prescribe 7 hard days.',
].join('\n')

export const PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    plan: {
      type: 'object',
      properties: {
        focus: { type: 'string' },
        rationale: { type: 'string' },
        targetWeeklyKm: { type: 'number' },
        keyWorkout: { type: 'string' },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        sessions: {
          type: 'array',
          maxItems: 7,
          items: {
            type: 'object',
            properties: {
              day: { type: 'string' },
              kind: {
                type: 'string',
                enum: [
                  'rest',
                  'recovery',
                  'easy',
                  'long',
                  'tempo',
                  'threshold',
                  'intervals',
                  'race_pace',
                  'cross_training',
                ],
              },
              title: { type: 'string' },
              description: { type: 'string' },
              distanceKm: { type: 'number' },
              targetPace: { type: 'string' },
            },
            required: ['day', 'kind', 'title', 'description'],
          },
        },
      },
      required: ['focus', 'rationale', 'targetWeeklyKm', 'sessions', 'confidence'],
    },
  },
  required: ['plan'],
} as const

export function buildPlanUserPrompt(input: PlanInput): string {
  return [
    'Athlete snapshot + this year\'s goal (JSON). Build this week from this and only this:',
    JSON.stringify(input),
  ].join('\n')
}
