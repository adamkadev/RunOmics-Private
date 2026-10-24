import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getAllRoutes } from '@/application/usecases/GetAllRoutes'
import { loadData } from '@/application/usecases/LoadData'
import { encodePolyline } from '@/lib/polyline'

// Revalidated on every request: a sync can change the routes without a deployment emptying any cache.
const CACHED = 'private, no-cache'

type Built = { body: string; etag: string }

/** Built once per data generation: each request used to stringify and hash 2 MB, even to answer 304. */
const built = new WeakMap<object, Map<string, Built>>()

export async function GET(req: NextRequest) {
  await loadData()
  const clusterId = req.nextUrl.searchParams.get('cluster')
  const encoded = req.nextUrl.searchParams.get('enc') === 'p5'
  const data = getAllRoutes()
  const cluster = data.clusters.find((c) => c.id === clusterId)

  if (!cluster) {
    return NextResponse.json({ error: 'Unknown cluster' }, { status: 404 })
  }

  let byKey = built.get(data)
  if (!byKey) built.set(data, (byKey = new Map()))
  const key = `${cluster.id}|${encoded ? 'p5' : 'json'}`
  let answer = byKey.get(key)
  if (!answer) {
    // A page built before this deployment holds route indices a newer run may have shifted, and the Explore worker
    // caches tracks by id.
    const routes: Record<number, [number, number][] | string> = {}
    const ids: Record<number, string> = {}
    for (const i of cluster.routeIndices) {
      const coords = data.routes[i]
      const id = data.routeMeta[i]?.id
      if (!coords) continue
      routes[i] = encoded ? encodePolyline(coords) : coords
      if (id) ids[i] = id
    }
    const body = JSON.stringify({ routes, ids })
    answer = { body, etag: `"${createHash('sha1').update(body).digest('base64url')}"` }
    byKey.set(key, answer)
  }

  const headers = { 'Cache-Control': CACHED, etag: answer.etag }
  if (req.headers.get('if-none-match') === answer.etag) return new NextResponse(null, { status: 304, headers })
  return new NextResponse(answer.body, { headers: { ...headers, 'content-type': 'application/json' } })
}
