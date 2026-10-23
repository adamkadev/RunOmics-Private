import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn() },
}))

const { getLocationOverride } = await import('../JsonLocationOverrideRepository')

vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ 'Le Petit-Bourg': 'Grand-Ville' }))

describe('getLocationOverride', () => {
  it('resolves a name the dataset overrides', () => {
    expect(getLocationOverride('Le Petit-Bourg')).toBe('Grand-Ville')
  })

  it('leaves a name with no override alone', () => {
    expect(getLocationOverride('Nowhere')).toBeNull()
  })

  it('never answers with an inherited object property', () => {
    expect(getLocationOverride('constructor')).toBeNull()
    expect(getLocationOverride('toString')).toBeNull()
    expect(getLocationOverride('__proto__')).toBeNull()
  })

  it('answers null when the dataset carries no overrides file', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      // Shaped like the real thing: readJsonFile tells absence from a read failure by the `code`.
      throw Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' })
    })
    vi.resetModules()
    const { getLocationOverride: withoutFile } = await import('../JsonLocationOverrideRepository')

    expect(withoutFile('Le Petit-Bourg')).toBeNull()
  })
})
