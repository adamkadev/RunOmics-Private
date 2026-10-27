import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { isAuthorizedOpsRequest } from '@/lib/internalAuth'
import { sendPush } from '@/lib/sendPushNotification'
import { opsStrings } from '@/lib/opsPush'

const MAX_TITLE = 100
const MAX_BODY = 300
const MAX_FROM = 40
const MAX_LINK = 300
const MAX_TAG = 100

// Control, format and line separator characters could split the push or, as a bidi override, disguise it.
const PRINTABLE = /^[^\p{C}\p{Zl}\p{Zp}]+$/u

function isLine(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= max && PRINTABLE.test(value)
}

function isHttpsLink(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_LINK || !/^[\x21-\x7E]+$/.test(value)) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
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

      const { title, body, from, link, tag } = payload as Record<string, unknown>
      if (!isLine(title, MAX_TITLE) || !isLine(body, MAX_BODY) || !isLine(from, MAX_FROM)) {
        return NextResponse.json({ error: 'title, body and from must be printable lines' }, { status: 400 })
      }
      if (link !== undefined && !isHttpsLink(link)) {
        return NextResponse.json({ error: `link must be an https URL of at most ${MAX_LINK} characters` }, { status: 400 })
      }
      if (tag !== undefined && !isLine(tag, MAX_TAG)) {
        return NextResponse.json({ error: `tag must be a printable line of at most ${MAX_TAG} characters` }, { status: 400 })
      }

      await sendPush('always', {
        title: opsStrings.forwarded(from, title),
        body,
        link,
        // Prefixed by its source, so one deployment's warning never replaces the same warning from another.
        tag: tag === undefined ? undefined : `${from}:${tag}`,
      })
      return NextResponse.json({ sent: true })
    },
    isAuthorizedOpsRequest,
  )
}
