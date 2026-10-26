import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { isAuthorizedOpsRequest } from '@/lib/internalAuth'
import { sendPush } from '@/lib/sendPushNotification'
import { opsStrings } from '@/lib/opsPush'

const MAX_TITLE = 100
const MAX_BODY = 300
const MAX_FROM = 40

// Control, format and line separator characters could split the push or, as a bidi override, disguise it.
const PRINTABLE = /^[^\p{C}\p{Zl}\p{Zp}]+$/u

function isLine(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= max && PRINTABLE.test(value)
}

/** Another deployment's operator alert: its own devices belong to its athlete, so it sends the alert here instead. */
export async function POST(req: NextRequest) {
  return handleInternalRoute(
    'ops-push',
    req,
    async () => {
      const payload: unknown = await req.json().catch(() => undefined)
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        return NextResponse.json({ error: 'body must be a JSON object' }, { status: 400 })
      }

      const { title, body, from } = payload as Record<string, unknown>
      if (!isLine(title, MAX_TITLE) || !isLine(body, MAX_BODY) || !isLine(from, MAX_FROM)) {
        return NextResponse.json({ error: 'title, body and from must be printable lines' }, { status: 400 })
      }

      await sendPush('always', opsStrings.forwarded(from, title), body)
      return NextResponse.json({ sent: true })
    },
    isAuthorizedOpsRequest,
  )
}
