import { NextResponse, type NextRequest } from 'next/server'
import { getAllRoutes } from '@/application/usecases/GetAllRoutes'

// GPS coordinates for one heatmap zone, fetched on demand once the user actually
// looks at it - keeps the /map page's initial load free of route geometry
// (see MapShellData / getMapShellData). Keyed by absolute activity index so the
// client can merge results straight into its sparse routes-by-index cache.
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

  return NextResponse.json({ routes })
}
