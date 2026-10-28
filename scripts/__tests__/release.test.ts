import { describe, expect, it } from 'vitest'
import { compareVersions, releaseChangelog } from '../release.mjs'

const CHANGELOG = `# Changelog

## [Unreleased]

- A new card.

## [3.2.1] - 2026-10-22

- A fix.
`

describe('release', () => {
  it('orders versions by number, not as text', () => {
    expect(compareVersions('3.10.0', '3.9.9')).toBeGreaterThan(0)
    expect(compareVersions('3.3.0', '3.3.0')).toBe(0)
    expect(compareVersions('3.2.0', '3.2.1')).toBeLessThan(0)
  })

  it('refuses a version that is not x.y.z', () => {
    expect(() => compareVersions('v3.3', '3.2.1')).toThrow('not a version')
  })

  it('moves the unreleased lines under a dated version and leaves an empty unreleased section', () => {
    expect(releaseChangelog(CHANGELOG, '3.3.0', '2026-10-27')).toBe(`# Changelog

## [Unreleased]

## [3.3.0] - 2026-10-27

- A new card.

## [3.2.1] - 2026-10-22

- A fix.
`)
  })

  it('refuses an empty unreleased section and a version already released', () => {
    const released = releaseChangelog(CHANGELOG, '3.3.0', '2026-10-27')
    expect(() => releaseChangelog(released, '3.3.1', '2026-10-28')).toThrow('nothing to release')
    expect(() => releaseChangelog(CHANGELOG, '3.2.1', '2026-10-27')).toThrow('already has a 3.2.1 section')
  })
})
