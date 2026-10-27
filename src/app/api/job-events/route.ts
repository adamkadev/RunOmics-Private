import { NextResponse, type NextRequest } from 'next/server'
import { lastJobRuns } from '@/application/usecases/JobEvents'
import { lastAiPass } from '@/application/usecases/AiPassStatus'
import { requireOwner } from '@/lib/ownerRoute'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET(req: NextRequest) {
  const denied = await requireOwner(req)
  if (denied) return denied
  const [jobs, ai] = await Promise.all([lastJobRuns(), lastAiPass()])
  return NextResponse.json({ jobs, ai }, { headers: NO_STORE })
}
