import { NextResponse, type NextRequest } from 'next/server'
import { getAllRoutes } from '@/application/usecases/GetAllRoutes'

// The routes are read from the deployment's own data, so they change only
// when a new deployment ships - and a new deployment starts with an empty
// edge cache. An hour fresh, then a day served stale while it revalidates.
const CACHED = 'public, s-maxage=3600, stale-while-revalidate=86400'

export async function GET(req: NextRequest) {
  const clusterId = req.nextUrl.searchParams.get('cluster')
  const data = getAllRoutes()
  const cluster = data.clusters.find((c) => c.id === clusterId)

  if (!cluster) {
    return NextResponse.json({ error: 'Unknown cluster' }, { status: 404 })
  }

  // Each track's activity id beside it: a page built before this deployment
  // holds route indices that a newer run may have shifted, and the Explore
  // worker caches tracks by id, so it checks which run each index now is.
  const routes: Record<number, [number, number][]> = {}
  const ids: Record<number, string> = {}
  for (const i of cluster.routeIndices) {
    const coords = data.routes[i]
    const id = data.routeMeta[i]?.id
    if (!coords) continue
    routes[i] = coords
    if (id) ids[i] = id
  }

  return NextResponse.json({ routes, ids }, { headers: { 'Cache-Control': CACHED } })
}
