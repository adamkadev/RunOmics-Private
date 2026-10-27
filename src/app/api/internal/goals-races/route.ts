import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { exportGoalsRaces } from '@/application/usecases/ExportGoalsRaces'

/** For the sync, which commits the app's races and goals to the data repository, where every page and the coach read them. */
export async function GET(req: NextRequest) {
  return handleInternalRoute('goals-races', req, async () => {
    const exported = await exportGoalsRaces()
    if (!exported) return NextResponse.json({ error: 'Firestore did not answer' }, { status: 503 })
    return NextResponse.json(exported, { headers: { 'cache-control': 'no-store' } })
  })
}
