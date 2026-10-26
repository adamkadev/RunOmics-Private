import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/application/usecases/GetAllRoutes', () => ({
  getAllRoutes: () => DATA,
  getMapVersion: () => '1.current',
}))

const DATA = {
  clusters: [{ id: 'home', routeIndices: [0, 2] }],
  routes: [
    [[49.61, 6.13], [49.62, 6.14]],
    [[50.0, 7.0]],
    [[49.6, 6.1]],
  ],
  routeMeta: [{ id: 'run-a' }, { id: 'run-b' }, { id: 'run-c' }],
}

const { GET } = await import('../route')

const request = (query: string) => new NextRequest(`https://example.com/api/map/routes?${query}`)

describe('GET /api/map/routes', () => {
  it("returns the cluster's routes with their activity ids, revalidated by ETag: a sync can change them without a deployment", async () => {
    const res = await GET(request('cluster=home'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      routes: { 0: [[49.61, 6.13], [49.62, 6.14]], 2: [[49.6, 6.1]] },
      ids: { 0: 'run-a', 2: 'run-c' },
    })
    expect(res.headers.get('cache-control')).toBe('private, no-cache')

    const again = new NextRequest(request('cluster=home'), { headers: { 'if-none-match': res.headers.get('etag')! } })
    expect((await GET(again)).status).toBe(304)
  })

  it('keeps an answer for good when it names the current data version, and never one for an older version', async () => {
    expect((await GET(request('cluster=home&v=1.current'))).headers.get('cache-control')).toBe('private, max-age=31536000, immutable')
    expect((await GET(request('cluster=home&v=1.older'))).headers.get('cache-control')).toBe('private, no-cache')
  })

  it('does not cache an unknown cluster, which a later deployment may add', async () => {
    const res = await GET(request('cluster=nowhere'))

    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBeNull()
  })
})
