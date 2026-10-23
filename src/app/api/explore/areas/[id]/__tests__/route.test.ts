import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getExploreAreaFile = vi.hoisted(() => vi.fn())
vi.mock('@/application/usecases/GetExploreAreas', () => ({ getExploreAreaFile }))

const { GET } = await import('../route')

const VERSION = 'demo-20261022-0123abcd'
const BODY = JSON.stringify({ type: 'FeatureCollection', runomics: { id: 'demo', version: VERSION }, features: [] })

function get(id: string, { v, etag }: { v?: string; etag?: string } = {}) {
  const url = `https://run.example/api/explore/areas/${encodeURIComponent(id)}${v ? `?v=${v}` : ''}`
  return GET(new NextRequest(url, { headers: etag ? { 'if-none-match': etag } : {} }), { params: Promise.resolve({ id }) })
}

describe('GET /api/explore/areas/[id]', () => {
  beforeEach(() => {
    getExploreAreaFile.mockReset()
    getExploreAreaFile.mockImplementation((id: string) => (id === 'demo' ? { version: VERSION, body: BODY } : null))
  })

  it('serves the area file as GeoJSON, tagged with its version', async () => {
    const res = await get('demo')

    expect(res.status).toBe(200)
    expect(await res.text()).toBe(BODY)
    expect(res.headers.get('content-type')).toBe('application/geo+json; charset=utf-8')
    expect(res.headers.get('etag')).toBe(`"${VERSION}"`)
  })

  it('keeps a request for the current version for good, and makes any other revalidate', async () => {
    expect((await get('demo', { v: VERSION })).headers.get('cache-control')).toBe('private, max-age=31536000, immutable')
    expect((await get('demo')).headers.get('cache-control')).toBe('private, no-cache')
    expect((await get('demo', { v: 'demo-20250101-ffffffff' })).headers.get('cache-control')).toBe('private, no-cache')
  })

  it('answers an empty 304 to a browser holding this version', async () => {
    for (const etag of [`"${VERSION}"`, `W/"${VERSION}"`, `"old", "${VERSION}"`, '*']) {
      const res = await get('demo', { etag })
      expect(res.status).toBe(304)
      expect(await res.text()).toBe('')
      expect(res.headers.get('etag')).toBe(`"${VERSION}"`)
    }
  })

  it('serves the file in full to a browser holding another version', async () => {
    const res = await get('demo', { etag: '"demo-20250101-ffffffff"' })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(BODY)
  })

  it('answers 404 for an area the index does not list, uncached', async () => {
    const res = await get('elsewhere')

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Unknown area' })
    expect(res.headers.get('cache-control')).toBeNull()
  })

  it('turns away an id that could not be an area before reading anything', async () => {
    for (const id of ['../index', 'Demo', 'demo.geojson', '', 'a'.repeat(65)]) {
      expect((await get(id)).status).toBe(404)
    }
    expect(getExploreAreaFile).not.toHaveBeenCalled()
  })
})
