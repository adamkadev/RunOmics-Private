import fs from 'fs'
import type {
  ActivityEvaluationRequest,
  AdvisorRecommendation,
  BootstrapRequest,
  CoachingAdvisor,
  CoachingPlanDraft,
  WeeklyReviewRequest,
} from '@/application/ports/CoachingAdvisor'
import { parseBootstrapPlanDraft, parseRecommendation } from './coachingAnswer'
import { activityEvaluationPrompt, bootstrapPrompt, weeklyReviewPrompt, type CoachingPromptParts } from './coachingPrompt'

export class ManualPromptWritten extends Error {
  constructor(readonly promptPath: string) {
    super(`Coaching prompt written to ${promptPath}`)
    this.name = 'ManualPromptWritten'
  }
}

/** Gemini's responseSchema dialect shouts its types; every other reader expects JSON Schema. */
function jsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(jsonSchema)
  if (typeof node !== 'object' || node === null) return node

  return Object.fromEntries(
    Object.entries(node).map(([key, value]) =>
      key === 'type' && typeof value === 'string' ? [key, value.toLowerCase()] : [key, jsonSchema(value)],
    ),
  )
}

function renderPrompt({ systemInstruction, userPrompt, schema }: CoachingPromptParts, situation: string): string {
  return [
    'You are a running coach. Follow every rule below, then answer with JSON only.',
    '',
    '## Rules',
    '',
    systemInstruction,
    '',
    `## ${situation}`,
    '',
    userPrompt,
    '',
    '## Answer format',
    '',
    'Reply with a single JSON object and nothing else - no explanation before or',
    'after it, and no markdown code fence. It must validate against this schema:',
    '',
    JSON.stringify(jsonSchema(schema), null, 2),
    '',
  ].join('\n')
}

export function renderManualPrompt(input: BootstrapRequest): string {
  return renderPrompt(bootstrapPrompt(input), 'Your athlete and the planning period')
}

export function renderEvaluationPrompt(input: ActivityEvaluationRequest): string {
  return renderPrompt(activityEvaluationPrompt(input), 'Your athlete, the current plan and the completed run')
}

export function renderReviewPrompt(input: WeeklyReviewRequest): string {
  return renderPrompt(weeklyReviewPrompt(input), 'Your athlete and the current plan')
}

/** The coach runs through Claude Code with no API key: the prompt goes to a file and the reply comes back as one. */
export class ManualCoachingAdvisor implements CoachingAdvisor {
  readonly source = 'manual' as const
  private consumed = false

  constructor(
    private readonly promptPath: string,
    private readonly answerPath: string | undefined,
  ) {}

  async bootstrap(input: BootstrapRequest): Promise<CoachingPlanDraft> {
    return parseBootstrapPlanDraft(this.answerOrPrompt(() => renderManualPrompt(input)))
  }

  async evaluateActivity(input: ActivityEvaluationRequest): Promise<AdvisorRecommendation> {
    return parseRecommendation(this.answerOrPrompt(() => renderEvaluationPrompt(input)), 'post_activity')
  }

  async reviewWeek(input: WeeklyReviewRequest): Promise<AdvisorRecommendation> {
    return parseRecommendation(this.answerOrPrompt(() => renderReviewPrompt(input)), 'weekly_review')
  }

  /** The answer is read once: a rejected one is asked for again on disk rather than replayed. */
  private answerOrPrompt(render: () => string): unknown {
    const answer = this.consumed ? undefined : this.readAnswer()
    if (answer !== undefined) {
      this.consumed = true
      return answer
    }

    fs.writeFileSync(this.promptPath, render())
    throw new ManualPromptWritten(this.promptPath)
  }

  private readAnswer(): unknown {
    if (!this.answerPath) return undefined
    if (!fs.existsSync(this.answerPath)) {
      throw new Error(`--from-answer ${this.answerPath} does not exist; save the reply there first`)
    }

    const raw = fs.readFileSync(this.answerPath, 'utf-8').trim()
    // Chat UIs fence JSON even when told not to.
    const unfenced = raw.startsWith('```') ? raw.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '') : raw

    try {
      return JSON.parse(unfenced) as unknown
    } catch (error) {
      throw new Error(`${this.answerPath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
