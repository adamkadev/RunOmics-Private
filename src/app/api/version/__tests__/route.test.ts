import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/version', () => ({ BUILD_COMMIT: 'abc1234' }))

const { GET } = await import('../route')

describe('GET /api/version', () => {
  it('answers the deployment’s commit, never from a cache', async () => {
    const res = GET()

    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ build: 'abc1234' })
  })
})
