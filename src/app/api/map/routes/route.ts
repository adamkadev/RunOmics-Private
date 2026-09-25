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

  const routes: Record<number, [number, number][]> = {}
  for (const i of cluster.routeIndices) {
    const coords = data.routes[i]
    if (coords) routes[i] = coords
  }

  return NextResponse.json({ routes }, { headers: { 'Cache-Control': CACHED } })
}
