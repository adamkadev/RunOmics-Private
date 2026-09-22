import fs from 'fs'
import { describe, expect, it } from 'vitest'
import { BOOTSTRAP_SYSTEM_INSTRUCTION } from '@/infrastructure/ai/coachingPrompt'
import { GENERATED_PATH, expectedGenerated, rulesFromMarkdown } from '../coachingRules'

describe('coaching rules generation', () => {
  it('keeps the committed file in step with the Markdown', () => {
    expect(fs.readFileSync(GENERATED_PATH, 'utf-8')).toBe(expectedGenerated())
  })

  it('sends the planner exactly what the rules file says', () => {
    expect(BOOTSTRAP_SYSTEM_INSTRUCTION).toBe(
      rulesFromMarkdown(fs.readFileSync('.claude/skills/coaching-plan/rules.md', 'utf-8')),
    )
  })

  it('keeps headings and editor notes out of the instruction', () => {
    expect(BOOTSTRAP_SYSTEM_INSTRUCTION).not.toContain('##')
    expect(BOOTSTRAP_SYSTEM_INSTRUCTION).not.toContain('build:coaching-rules')
  })

  it('refuses a rules file with no rules in it', () => {
    expect(() => rulesFromMarkdown('# Coaching rules\n\nProse only.\n')).toThrow(/No rules found/)
  })
})
