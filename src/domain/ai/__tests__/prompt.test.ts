import { afterEach, describe, expect, it, vi } from 'vitest'

/** The locale is read once, at import: each case loads the rules under its own. */
async function promptIn(locale: 'en' | 'fr') {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_LOCALE', locale)
  return import('../prompt')
}

const LIMITS = { headline: 52, body: 140 }

describe('prompt rules by locale', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('leaves an English build’s prompt versions, and so its cached cards, as they were', async () => {
    const { promptVersion, CARD_PROMPT_VERSION } = await promptIn('en')
    expect(promptVersion(CARD_PROMPT_VERSION)).toBe(CARD_PROMPT_VERSION)
  })

  it('versions the French rules on their own, so tightening them rewrites French copy only', async () => {
    const { promptVersion } = await promptIn('fr')
    expect(promptVersion(4)).toMatch(/^4-fr\d+$/)
  })

  it('asks a French build for French as a coach says it, agreeing nothing with the athlete', async () => {
    const { systemInstruction } = await promptIn('fr')
    const rules = systemInstruction('Coach.', 'one sentence', LIMITS)
    expect(rules).toContain('never as a translation')
    expect(rules).toContain('no adjective or past participle may agree with the athlete')
    expect(rules).toContain('tutoiement')
    expect(rules).not.toContain('Write in English')
  })

  it('keeps English rules English', async () => {
    const { systemInstruction } = await promptIn('en')
    const rules = systemInstruction('Coach.', 'one sentence', LIMITS)
    expect(rules).toContain('Write in English, second person.')
    expect(rules).not.toContain('tutoiement')
  })
})
