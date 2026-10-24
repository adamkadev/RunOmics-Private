import { describe, expect, it } from 'vitest'
import { shouldReload } from '../appUpdate'

describe('shouldReload', () => {
  const back = { awayMs: 5 * 60_000, ownBuild: 'aaa1111', liveBuild: 'bbb2222', editing: false }

  it('reloads a page that comes back behind the live deploy', () => {
    expect(shouldReload(back)).toBe(true)
  })

  it('stays on the same build, a short absence, a field being typed in, or an unknown answer', () => {
    expect(shouldReload({ ...back, liveBuild: 'aaa1111' })).toBe(false)
    expect(shouldReload({ ...back, awayMs: 10_000 })).toBe(false)
    expect(shouldReload({ ...back, editing: true })).toBe(false)
    expect(shouldReload({ ...back, liveBuild: null })).toBe(false)
    expect(shouldReload({ ...back, ownBuild: 'local' })).toBe(false)
  })
})
