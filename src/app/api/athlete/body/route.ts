import { NextResponse, type NextRequest } from 'next/server'
import { getAthleteBody } from '@/application/usecases/GetAthleteBody'
import { loadData } from '@/application/usecases/LoadData'
import { requireOwner } from '@/lib/ownerRoute'

// Settings fetches these after sign-in, so a viewer's copy of the cached page never holds the owner's height and weight.

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET(req: NextRequest) {
  const denied = await requireOwner(req)
  if (denied) return denied
  await loadData()
  return NextResponse.json(getAthleteBody(), { headers: NO_STORE })
}
