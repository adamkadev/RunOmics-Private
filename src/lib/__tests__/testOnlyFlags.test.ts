import { describe, expect, it } from 'vitest'
import { assertNoTestFlagsOnDeployment, TEST_ONLY_FLAGS } from '../testOnlyFlags'

describe('assertNoTestFlagsOnDeployment', () => {
  it.each(TEST_ONLY_FLAGS)('refuses %s on Vercel', (name) => {
    expect(() => assertNoTestFlagsOnDeployment({ VERCEL: '1', [name]: '127.0.0.1:9099' })).toThrow(name)
  })

  it('lets a test build set every flag off Vercel', () => {
    const env = Object.fromEntries(TEST_ONLY_FLAGS.map((name) => [name, '1']))
    expect(() => assertNoTestFlagsOnDeployment(env)).not.toThrow()
  })

  it('lets a deployment build without any flag', () => {
    expect(() => assertNoTestFlagsOnDeployment({ VERCEL: '1', NEXT_PUBLIC_E2E_MAPS: '' })).not.toThrow()
  })
})
