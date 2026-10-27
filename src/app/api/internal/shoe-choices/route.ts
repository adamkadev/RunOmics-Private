import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { exportShoeChoices } from '@/application/usecases/ExportShoeChoices'

/** For the sync, which commits the owner's shoe picks to the data repository, where the shoes' mileage reads them. */
export async function GET(req: NextRequest) {
  return handleInternalRoute('shoe-choices', req, async () => {
    const exported = await exportShoeChoices()
    if (!exported) return NextResponse.json({ error: 'Firestore did not answer' }, { status: 503 })
    return NextResponse.json(exported, { headers: { 'cache-control': 'no-store' } })
  })
}
