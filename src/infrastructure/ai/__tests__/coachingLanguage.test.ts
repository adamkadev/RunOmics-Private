import { afterEach, describe, expect, it, vi } from 'vitest'
import { BOOTSTRAP_SYSTEM_INSTRUCTION as BOOTSTRAP_RULES } from '../coachingRules.generated'

/** The locale is read once, at import: each case loads the prompt under its own. */
async function promptIn(locale: 'en' | 'fr') {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_LOCALE', locale)
  return import('../coachingPrompt')
}

describe('the coach writes in the deployment’s language', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('leaves an English build’s rules exactly as the Markdown has them', async () => {
    const { BOOTSTRAP_SYSTEM_INSTRUCTION, withCoachingLanguage } = await promptIn('en')
    expect(BOOTSTRAP_SYSTEM_INSTRUCTION).toBe(BOOTSTRAP_RULES)
    expect(withCoachingLanguage('Review the plan.')).toBe('Review the plan.')
  })

  it('asks a French build for French text and English JSON', async () => {
    const { BOOTSTRAP_SYSTEM_INSTRUCTION, withCoachingLanguage } = await promptIn('fr')
    expect(BOOTSTRAP_SYSTEM_INSTRUCTION.startsWith(BOOTSTRAP_RULES)).toBe(true)
    expect(BOOTSTRAP_SYSTEM_INSTRUCTION).toContain('in French')
    expect(BOOTSTRAP_SYSTEM_INSTRUCTION).toContain('Keep every JSON key, enum value, id and date exactly as specified, in English.')
    expect(BOOTSTRAP_SYSTEM_INSTRUCTION).toContain('« moins de sorties »')
    expect(withCoachingLanguage('Review the plan.')).toMatch(/^Review the plan\. Write every text the athlete reads in French/)
  })
})
