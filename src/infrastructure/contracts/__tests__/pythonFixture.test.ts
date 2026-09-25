import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkDataDirectory } from '../dataContract'

/**
 * The TypeScript half of the Python contract test. fixtures/contract/ holds
 * exactly what the real Python mapper and store write for a realistic
 * activity - scripts/tests/test_contract_fixture.py fails the moment that
 * output changes - and this test holds those same files to the app's
 * contract. A field the sync renames or retypes fails one of the two.
 */
const FIXTURE = path.resolve(__dirname, '../../../../fixtures/contract')

describe('what the Python sync writes', () => {
  it('honours the contract the app reads it by', () => {
    expect(checkDataDirectory(FIXTURE)).toEqual([])
  })
})
