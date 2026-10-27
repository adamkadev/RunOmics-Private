import { NextResponse, type NextRequest } from 'next/server'
import { lastJobRuns } from '@/application/usecases/JobEvents'
import { requireOwner } from '@/lib/ownerRoute'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET(req: NextRequest) {
  const denied = await requireOwner(req)
  if (denied) return denied
  return NextResponse.json({ jobs: await lastJobRuns() }, { headers: NO_STORE })
}
