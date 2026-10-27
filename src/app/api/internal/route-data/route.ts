import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { exportRouteData } from '@/application/usecases/ExportRouteData'

/** For the sync, which commits route names and avoid spots to the data repository: Firestore is otherwise their only copy. */
export async function GET(req: NextRequest) {
  return handleInternalRoute('route-data', req, async () => {
    const exported = await exportRouteData()
    if (!exported) return NextResponse.json({ error: 'Firestore did not answer' }, { status: 503 })
    return NextResponse.json(exported, { headers: { 'cache-control': 'no-store' } })
  })
}
