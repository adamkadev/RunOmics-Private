import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getRouteData } = vi.hoisted(() => ({ getRouteData: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreRouteDataRepository', () => ({ getRouteData }))

const { GET } = await import('../route')

const request = (secret = 'test-secret') => new NextRequest('https://example.com/api/internal/route-data', { headers: { 'x-internal-secret': secret } })

describe('GET /api/internal/route-data', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', 'test-secret')
    getRouteData.mockReset()
  })

  it('hands the sync every route name and avoid spot, sorted by id, as Firestore stores them', async () => {
    getRouteData.mockResolvedValue({
      available: true,
      routeNames: new Map([['2.351,48.857:2.360,48.870:8', 'Quais'], ['2.300,48.800:2.310,48.820:5', 'Parc']]),
      avoidSpots: [
        { id: 'b', lon: 2.35, lat: 48.85, radiusM: 80, createdAt: '2026-10-02', reason: 'mud' },
        { id: 'a', lon: 2.36, lat: 48.86, radiusM: 80, createdAt: '2026-10-01', reason: null },
      ],
    })

    const res = await GET(request())
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).toBe(JSON.stringify({
      names: { '2.300,48.800:2.310,48.820:5': { name: 'Parc' }, '2.351,48.857:2.360,48.870:8': { name: 'Quais' } },
      spots: {
        a: { lon: 2.36, lat: 48.86, radiusM: 80, createdAt: '2026-10-01' },
        b: { lon: 2.35, lat: 48.85, radiusM: 80, createdAt: '2026-10-02', reason: 'mud' },
      },
    }))
  })

  it('answers 503 when Firestore did not, so the sync keeps the last copy', async () => {
    getRouteData.mockResolvedValue({ available: false, routeNames: new Map(), avoidSpots: [] })
    expect((await GET(request())).status).toBe(503)
  })

  it('refuses a request without the internal secret', async () => {
    expect((await GET(request('wrong'))).status).toBe(401)
    expect(getRouteData).not.toHaveBeenCalled()
  })
})
