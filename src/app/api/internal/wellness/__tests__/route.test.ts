import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getWellnessEntries } = vi.hoisted(() => ({ getWellnessEntries: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreWellnessRepository', () => ({ getWellnessEntries }))

const { GET } = await import('../route')

const request = () => new NextRequest('https://example.com/api/internal/wellness', { headers: { 'x-internal-secret': 'test-secret' } })

describe('GET /api/internal/wellness', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', 'test-secret')
  })

  it('hands the sync every check-in, sorted by date, for a stable commit', async () => {
    getWellnessEntries.mockResolvedValue({
      available: true,
      entries: new Map([
        ['2026-10-25', { sleep: 4, niggle: { site: 'calf', side: 'left', pain: 3 } }],
        ['2026-10-24', { ill: true }],
      ]),
    })

    const res = await GET(request())
    expect(await res.text()).toBe('{"entries":{"2026-10-24":{"ill":true},"2026-10-25":{"sleep":4,"niggle":{"site":"calf","side":"left","pain":3}}}}')
  })

  it('answers 503 when Firestore did not, so the sync keeps the last copy', async () => {
    getWellnessEntries.mockResolvedValue({ available: false, entries: new Map() })
    expect((await GET(request())).status).toBe(503)
  })
})
