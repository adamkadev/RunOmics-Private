import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { exportActivityNotes } from '@/application/usecases/ExportActivityNotes'

/** For the sync, which commits the notes to the data repository: Firestore is otherwise their only copy. */
export async function GET(req: NextRequest) {
  return handleInternalRoute('activity-notes', req, async () => {
    const exported = await exportActivityNotes()
    if (!exported) return NextResponse.json({ error: 'Firestore did not answer' }, { status: 503 })
    return NextResponse.json(exported, { headers: { 'cache-control': 'no-store' } })
  })
}
