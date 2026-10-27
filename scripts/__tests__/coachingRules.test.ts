import fs from 'fs'
import { describe, expect, it } from 'vitest'
import { ADAPTATION_NAMING_RULE, BOOTSTRAP_SYSTEM_INSTRUCTION } from '@/infrastructure/ai/coachingPrompt'
import { ADAPTATION_READING_INSTRUCTION, WORKOUT_NAMING_INSTRUCTION } from '@/infrastructure/ai/coachingRules.generated'
import { weeklyReviewPrompt } from '@/infrastructure/ai/coachingPrompt'
import { buildCoachingContext } from '@/application/coaching/context'
import { plan } from '@/domain/coaching/__tests__/fixtures'
import { GENERATED_PATH, NAMING_SECTION, adaptationRules, expectedGenerated, rulesFromMarkdown } from '../coachingRules'

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

  it('states in every controlled threshold rule that it applies to a controlled threshold block alone', () => {
    const section = fs.readFileSync('.claude/skills/coaching-plan/rules.md', 'utf-8').split('\n## ').find((part) => part.startsWith('Controlled threshold blocks'))!
    const bullets = section.split('\n').filter((line) => line.startsWith('- '))

    expect(bullets.length).toBeGreaterThan(5)
    for (const bullet of bullets) {
      expect(bullet).toMatch(/^- (A controlled threshold block is|context\.autoregulation )|In a controlled threshold block/)
    }
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

  it('hands a change to the live plan the notes, check-in and return-to-running rules', () => {
    const markdown = fs.readFileSync('.claude/skills/coaching-plan/rules.md', 'utf-8')
    const context = buildCoachingContext({
      activities: [], plan: plan(), athlete: {}, trainingStatus: null, loadBalance: null, trainingZones: null, trajectories: null,
      latestVo2max: null, racePredictions: null, goals: [], personalBests: [], upcomingRaces: [], officialResults: [],
    }, '2026-09-14')

    expect(ADAPTATION_READING_INSTRUCTION).toBe(adaptationRules(markdown))
    expect(ADAPTATION_READING_INSTRUCTION).toContain('morning check-ins')
    expect(ADAPTATION_READING_INSTRUCTION).toContain('While returning')
    expect(weeklyReviewPrompt({ context, effectiveDate: '2026-09-14' }).systemInstruction).toContain(ADAPTATION_READING_INSTRUCTION)
  })

  it('refuses a section that is not there', () => {
    expect(() => rulesFromMarkdown('# Coaching rules\n\n- One rule.\n', NAMING_SECTION)).toThrow(/No "## Naming the workouts" section/)
  })
})
