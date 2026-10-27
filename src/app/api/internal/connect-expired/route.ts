import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { opsStrings, sendOpsPush } from '@/lib/opsPush'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Called by the sync the night garth's token is found expired, once. Body: `{ "since": "YYYY-MM-DD" }`. */
export async function POST(req: NextRequest) {
  return handleInternalRoute('connect-expired', req, async () => {
    const body: unknown = await req.json().catch(() => undefined)
    const since = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).since : undefined
    if (typeof since !== 'string' || !ISO_DATE.test(since) || Number.isNaN(Date.parse(since))) {
      return NextResponse.json({ error: 'since must be a YYYY-MM-DD date' }, { status: 400 })
    }

    await sendOpsPush(opsStrings.connectExpired.title, opsStrings.connectExpired.body(since))
    return NextResponse.json({ sent: true })
  })
}
