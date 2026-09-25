import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/application/usecases/GetAllRoutes', () => ({
  getAllRoutes: () => ({
    clusters: [{ id: 'home', routeIndices: [0, 2] }],
    routes: [
      [[49.61, 6.13], [49.62, 6.14]],
      [[50.0, 7.0]],
      [[49.6, 6.1]],
    ],
  }),
}))

const { GET } = await import('../route')

const request = (cluster: string) => new NextRequest(`https://example.com/api/map/routes?cluster=${cluster}`)

describe('GET /api/map/routes', () => {
  it("returns the cluster's routes, cached at the edge: they only change with a deployment", async () => {
    const res = await GET(request('home'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ routes: { 0: [[49.61, 6.13], [49.62, 6.14]], 2: [[49.6, 6.1]] } })
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=3600, stale-while-revalidate=86400')
  })

  it('does not cache an unknown cluster, which a later deployment may add', async () => {
    const res = await GET(request('nowhere'))

    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBeNull()
  })
})
