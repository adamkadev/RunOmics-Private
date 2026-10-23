import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkDataDirectory } from '../dataContract'

/**
 * The TypeScript half of the contract test: scripts/tests/test_contract_fixture.py pins
 * fixtures/contract/ to the Python sync's output, and this holds it to the app's contract.
 */
const FIXTURE = path.resolve(__dirname, '../../../../fixtures/contract')

describe('what the Python sync writes', () => {
  it('honours the contract the app reads it by', () => {
    expect(checkDataDirectory(FIXTURE)).toEqual([])
  })
})
