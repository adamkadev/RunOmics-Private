import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getAllRoutes } from '@/application/usecases/GetAllRoutes'
import { loadData } from '@/application/usecases/LoadData'

// Revalidated on every request: a sync can change the routes without a deployment emptying any cache.
const CACHED = 'private, no-cache'

export async function GET(req: NextRequest) {
  await loadData()
  const clusterId = req.nextUrl.searchParams.get('cluster')
  const data = getAllRoutes()
  const cluster = data.clusters.find((c) => c.id === clusterId)

  if (!cluster) {
    return NextResponse.json({ error: 'Unknown cluster' }, { status: 404 })
  }

  // A page built before this deployment holds route indices a newer run may have shifted, and the Explore worker
  // caches tracks by id.
  const routes: Record<number, [number, number][]> = {}
  const ids: Record<number, string> = {}
  for (const i of cluster.routeIndices) {
    const coords = data.routes[i]
    const id = data.routeMeta[i]?.id
    if (!coords) continue
    routes[i] = coords
    if (id) ids[i] = id
  }

  const body = JSON.stringify({ routes, ids })
  const etag = `"${createHash('sha1').update(body).digest('base64url')}"`
  const headers = { 'Cache-Control': CACHED, etag }
  if (req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers })
  return new NextResponse(body, { headers: { ...headers, 'content-type': 'application/json' } })
}
