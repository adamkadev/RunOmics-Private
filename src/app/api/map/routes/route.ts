import { NextResponse, type NextRequest } from 'next/server'
import { getAllRoutes } from '@/application/usecases/GetAllRoutes'

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
