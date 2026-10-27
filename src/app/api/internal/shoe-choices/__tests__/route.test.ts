import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getShoeChoicesFromFirestore } = vi.hoisted(() => ({ getShoeChoicesFromFirestore: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreShoeChoiceRepository', () => ({ getShoeChoicesFromFirestore }))

const { GET } = await import('../route')

const request = (secret = 'test-secret') => new NextRequest('https://example.com/api/internal/shoe-choices', { headers: { 'x-internal-secret': secret } })

describe('GET /api/internal/shoe-choices', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', 'test-secret')
    getShoeChoicesFromFirestore.mockReset()
  })

  it('hands the sync every run’s pick, sorted by id, and the default shoe', async () => {
    getShoeChoicesFromFirestore.mockResolvedValue({ available: true, runs: new Map([['22', 'b'], ['11', 'a']]), defaultGearId: 'a' })

    const res = await GET(request())
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).toBe(JSON.stringify({
      runs: { 11: { gearId: 'a' }, 22: { gearId: 'b' } },
      settings: { default: { gearId: 'a' } },
    }))
  })

  it('writes no default when none is set, as for an athlete without shoes', async () => {
    getShoeChoicesFromFirestore.mockResolvedValue({ available: true, runs: new Map(), defaultGearId: null })

    expect(await (await GET(request())).json()).toEqual({ runs: {}, settings: {} })
  })

  it('answers 503 when Firestore did not, so the sync keeps the last copy', async () => {
    getShoeChoicesFromFirestore.mockResolvedValue({ available: false, runs: new Map(), defaultGearId: null })
    expect((await GET(request())).status).toBe(503)
  })

  it('refuses a request without the internal secret', async () => {
    expect((await GET(request('wrong'))).status).toBe(401)
    expect(getShoeChoicesFromFirestore).not.toHaveBeenCalled()
  })
})
