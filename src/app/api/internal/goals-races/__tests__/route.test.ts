import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getGoalsRacesEntries } = vi.hoisted(() => ({ getGoalsRacesEntries: vi.fn() }))
vi.mock('@/infrastructure/repositories/FirestoreGoalsRacesRepository', () => ({ getGoalsRacesEntries }))

const { GET } = await import('../route')

const request = (secret = 'test-secret') => new NextRequest('https://example.com/api/internal/goals-races', { headers: { 'x-internal-secret': secret } })

describe('GET /api/internal/goals-races', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_NOTIFY_SECRET', 'test-secret')
    getGoalsRacesEntries.mockReset()
  })

  it('hands the sync every race and goal entry, sorted, as Firestore stores them', async () => {
    getGoalsRacesEntries.mockResolvedValue({
      available: true,
      races: [
        { id: 'b', name: 'Harbor 10K', date: '2027-04-11', distanceKm: 10, priority: 'A', targetSeconds: 2_700 },
        { id: 'a', garminKey: 'uuid-1', removed: true },
      ],
      goals: [
        { year: 2027, annualDistanceKm: 1_500, targets: { '10k': 2_700, marathon: null } },
        { year: 2026, removed: true },
      ],
    })

    const res = await GET(request())
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).toBe(JSON.stringify({
      races: {
        a: { garminKey: 'uuid-1', removed: true },
        b: { name: 'Harbor 10K', date: '2027-04-11', distanceKm: 10, priority: 'A', targetSeconds: 2_700 },
      },
      goals: {
        2026: { removed: true },
        2027: { annualDistanceKm: 1_500, targets: { '10k': 2_700, marathon: null } },
      },
    }))
  })

  it('answers 503 when Firestore did not, so the sync keeps the last copy', async () => {
    getGoalsRacesEntries.mockResolvedValue({ available: false, races: [], goals: [] })
    expect((await GET(request())).status).toBe(503)
  })

  it('refuses a request without the internal secret', async () => {
    expect((await GET(request('wrong'))).status).toBe(401)
    expect(getGoalsRacesEntries).not.toHaveBeenCalled()
  })
})
