import { NextResponse, type NextRequest } from 'next/server'
import { getActivityNote } from '@/application/usecases/GetActivityNote'

/**
 * An activity's note, read on the server (design review, Oct 2026). The page
 * used to read it straight from Firestore, whose rules let anyone fetch a note
 * by id - no sign-in a private site asks for could cover that. Read here, the
 * note sits behind the same gate as the page (src/proxy.ts), and the rules
 * keep notes to the owner.
 */

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/** One Firestore document id - one segment, so the read can only ever be one note. */
function isNoteId(id: string): boolean {
  return id.length > 0 && id.length <= 128 && !id.includes('/') && id !== '.' && id !== '..'
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isNoteId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // A server without the admin credentials says so in the answer rather than
  // as a 503: a deployment without notes is not an error, and every activity
  // page would log one.
  const read = await getActivityNote(id)
  if (!read.available) return NextResponse.json({ available: false }, { headers: NO_STORE })
  return NextResponse.json({ available: true, ...(read.note ?? { note: '', tags: [] }) }, { headers: NO_STORE })
}
