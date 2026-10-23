import { afterEach, describe, expect, it, vi } from 'vitest'

/** The locale is read once, at import: each case loads the helpers under French. */
async function inFrench() {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_LOCALE', 'fr')
  const [formatters, title] = await Promise.all([import('../formatters'), import('../activityTitle')])
  return { ...formatters, ...title }
}

describe('a French build', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('writes decimals with a comma', async () => {
    const { formatDecimal, formatNumber } = await inFrench()
    expect(formatDecimal(8.5, 1)).toBe('8,5')
    expect(formatDecimal(1.125, 2)).toBe('1,13')
    expect(formatNumber(17.5)).toBe('17,5')
  })

  // The sync stores the weekday in English.
  it('names a run with no Garmin name by its French weekday', async () => {
    const { activityTitle } = await inFrench()
    expect(activityTitle({ description: '', date: '2026-10-04' })).toBe('Sortie du dimanche')
    expect(activityTitle({ description: 'Metz Course à pied', date: '2026-10-04' })).toBe('Metz Course à pied')
  })
})
