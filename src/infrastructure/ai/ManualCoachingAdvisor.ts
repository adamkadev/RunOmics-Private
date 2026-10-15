import fs from 'fs'
import type {
  AdvisorRecommendation,
  BootstrapRequest,
  CoachingAdvisor,
  CoachingPlanDraft,
} from '@/application/ports/CoachingAdvisor'
import { parseBootstrapPlanDraft } from './coachingAnswer'
import {
  BOOTSTRAP_PLAN_RESPONSE_SCHEMA,
  BOOTSTRAP_SYSTEM_INSTRUCTION,
  bootstrapUserPrompt,
} from './coachingPrompt'

/** Raised once the prompt is on disk: the answer has to come from a human now. */
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

export function renderManualPrompt(input: BootstrapRequest): string {
  return [
    'You are a running coach. Follow every rule below, then answer with JSON only.',
    '',
    '## Rules',
    '',
    BOOTSTRAP_SYSTEM_INSTRUCTION,
    '',
    '## Your athlete and the planning period',
    '',
    bootstrapUserPrompt(input),
    '',
    '## Answer format',
    '',
    'Reply with a single JSON object and nothing else - no explanation before or',
    'after it, and no markdown code fence. It must validate against this schema:',
    '',
    JSON.stringify(jsonSchema(BOOTSTRAP_PLAN_RESPONSE_SCHEMA), null, 2),
    '',
  ].join('\n')
}

/**
 * Coaching runs about once a month, which is too rarely to be worth an API key
 * and a quota. This advisor renders the identical prompt to a file, waits for a
 * human to paste the reply back, and then hands it to the same validation and
 * preview path an API answer would take.
 */
export class ManualCoachingAdvisor implements CoachingAdvisor {
  // The answer is pasted from a chat, or written by hand: not a Gemini call.
  readonly source = 'manual' as const
  private consumed = false

  constructor(
    private readonly promptPath: string,
    private readonly answerPath: string | undefined,
  ) {}

  async bootstrap(input: BootstrapRequest): Promise<CoachingPlanDraft> {
    const answer = this.consumed ? undefined : this.readAnswer()
    if (answer !== undefined) {
      this.consumed = true
      return parseBootstrapPlanDraft(answer)
    }

    fs.writeFileSync(this.promptPath, renderManualPrompt(input))
    throw new ManualPromptWritten(this.promptPath)
  }

  private readAnswer(): unknown {
    if (!this.answerPath) return undefined
    if (!fs.existsSync(this.answerPath)) {
      throw new Error(`--from-answer ${this.answerPath} does not exist; save the chat's reply there first`)
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

  async evaluateActivity(): Promise<AdvisorRecommendation> {
    throw new Error('Manual coaching covers bootstrap only; run evaluate without --prompt-out')
  }

  async reviewWeek(): Promise<AdvisorRecommendation> {
    throw new Error('Manual coaching covers bootstrap only; run weekly-review without --prompt-out')
  }
}
