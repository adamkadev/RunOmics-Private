import fs from 'fs'
import { describe, expect, it } from 'vitest'
import { ADAPTATION_NAMING_RULE, BOOTSTRAP_SYSTEM_INSTRUCTION } from '@/infrastructure/ai/coachingPrompt'
import { WORKOUT_NAMING_INSTRUCTION } from '@/infrastructure/ai/coachingRules.generated'
import { GENERATED_PATH, NAMING_SECTION, expectedGenerated, rulesFromMarkdown } from '../coachingRules'

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

  it('hands a change to the live plan the naming rules, and only those', () => {
    const markdown = fs.readFileSync('.claude/skills/coaching-plan/rules.md', 'utf-8')
    expect(WORKOUT_NAMING_INSTRUCTION).toBe(rulesFromMarkdown(markdown, NAMING_SECTION))
    expect(WORKOUT_NAMING_INSTRUCTION).toContain('"Threshold · 3 × 8′ @ 4:25"')
    expect(WORKOUT_NAMING_INSTRUCTION).not.toContain('runsPerWeek')
    expect(BOOTSTRAP_SYSTEM_INSTRUCTION).toContain(WORKOUT_NAMING_INSTRUCTION)
    expect(ADAPTATION_NAMING_RULE).toContain(WORKOUT_NAMING_INSTRUCTION)
  })

  it('refuses a section that is not there', () => {
    expect(() => rulesFromMarkdown('# Coaching rules\n\n- One rule.\n', NAMING_SECTION)).toThrow(/No "## Naming the workouts" section/)
  })
})
