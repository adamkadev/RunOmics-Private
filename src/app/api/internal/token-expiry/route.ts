import { NextResponse, type NextRequest } from 'next/server'
import { checkTokenExpiry, type TokenKey } from '@/application/usecases/CheckTokenExpiry'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPush } from '@/lib/sendPushNotification'
import { t } from '@/i18n'

/** Called by the nightly sync. Body: `{ "tokens": [{ "name": "dataActions", "expiresAt": "<the header>" }] }`. */
export async function POST(req: NextRequest) {
  return handleInternalRoute('token-expiry', req, async () => {
    const body = (await req.json().catch(() => null)) as { tokens?: unknown } | null
    const { tokens, expiring } = await checkTokenExpiry(body?.tokens)
    if (expiring.length > 0) {
      const n = t.notifications.tokenExpiring
      const names = expiring.map((token) => n.names[token.name as TokenKey]).join(', ')
      await sendPush('always', n.title(Math.max(0, expiring[0]!.daysLeft)), n.body(names))
    }
    return NextResponse.json({
      tokens: tokens.map((token) => ({ name: token.name, expiresAt: token.expiresAt.toISOString().slice(0, 10) })),
      warned: expiring.length > 0,
    })
  })
}
