import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { exportWellness } from '@/application/usecases/ExportWellness'

/** For the sync, which commits the check-ins to the data repository: Firestore is otherwise their only copy. */
export async function GET(req: NextRequest) {
  return handleInternalRoute('wellness', req, async () => {
    const exported = await exportWellness()
    if (!exported) return NextResponse.json({ error: 'Firestore did not answer' }, { status: 503 })
    return NextResponse.json(exported, { headers: { 'cache-control': 'no-store' } })
  })
}
