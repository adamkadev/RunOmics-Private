import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPush } from '@/lib/sendPushNotification'
import { t } from '@/i18n'

const MAX_LENGTH = 200
const RUN_URL_PREFIX = 'https://github.com/'

// Control, format and line separator characters could split the title or, as a bidi override, disguise it.
const PRINTABLE = /^[^\p{C}\p{Zl}\p{Zp}]+$/u
// The rest of a run URL is visible ASCII: no spaces, nothing to hide behind.
const URL_PATH = /^[\x21-\x7E]+$/

function isWorkflowName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_LENGTH && value.trim() !== '' && PRINTABLE.test(value)
}

function isRunUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_LENGTH &&
    value.startsWith(RUN_URL_PREFIX) &&
    URL_PATH.test(value.slice(RUN_URL_PREFIX.length))
  )
}

/** Called from a scheduled workflow's failure step. Body: `{ "workflow": "<name>", "runUrl": "https://github.com/…" }`. */
export async function POST(req: NextRequest) {
  return handleInternalRoute('workflow-failure', req, async () => {
    const body: unknown = await req.json().catch(() => undefined)
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'body must be a JSON object' }, { status: 400 })
    }

    const { workflow, runUrl } = body as Record<string, unknown>
    if (!isWorkflowName(workflow)) {
      return NextResponse.json(
        { error: `workflow must be a printable name of at most ${MAX_LENGTH} characters` },
        { status: 400 }
      )
    }
    if (!isRunUrl(runUrl)) {
      return NextResponse.json(
        { error: `runUrl must be a ${RUN_URL_PREFIX} link of at most ${MAX_LENGTH} characters` },
        { status: 400 }
      )
    }

    await sendPush('always', t.notifications.workflowFailed.title(workflow), t.notifications.workflowFailed.body(runUrl))
    return NextResponse.json({ sent: true })
  })
}
