import { NextResponse, type NextRequest } from 'next/server'
import { checkTokenExpiry, type GitHubTokenKey } from '@/application/usecases/CheckTokenExpiry'
import { handleInternalRoute } from '@/lib/internalRoute'
import { opsStrings, sendOpsPush } from '@/lib/opsPush'
import { pushPaths } from '@/lib/pushLinks'
import type { Push } from '@/lib/sendPushNotification'

/** Called by the nightly sync. Body: `{ "tokens": [{ "name": "dataActions", "expiresAt": "<the header>" }] }`. */
export async function POST(req: NextRequest) {
  return handleInternalRoute('token-expiry', req, async () => {
    const body = (await req.json().catch(() => null)) as { tokens?: unknown } | null
    const { tokens, expiring } = await checkTokenExpiry(body?.tokens)

    const pushes: Push[] = []
    const github = expiring.filter((token) => token.name !== 'garminKey')
    if (github.length > 0) {
      const n = opsStrings.tokenExpiring
      const names = github.map((token) => n.names[token.name as GitHubTokenKey]).join(', ')
      pushes.push({ title: n.title(Math.max(0, github[0]!.daysLeft)), body: n.body(names), link: pushPaths.settings, tag: 'token-expiry' })
    }
    const garminKey = expiring.find((token) => token.name === 'garminKey')
    if (garminKey) {
      const n = opsStrings.garminKeyExpiring
      pushes.push({ title: n.title(Math.max(0, garminKey.daysLeft)), body: n.body, link: pushPaths.settings, tag: 'garmin-key-expiry' })
    }

    const failures = (await Promise.allSettled(pushes.map((push) => sendOpsPush(push)))).filter((result) => result.status === 'rejected')
    if (failures.length) throw new AggregateError(failures.map((failure) => failure.reason), `${failures.length} of ${pushes.length} token warnings failed`)

    return NextResponse.json({
      tokens: tokens.map((token) => ({ name: token.name, expiresAt: token.expiresAt.toISOString().slice(0, 10) })),
      warned: expiring.length > 0,
    })
  })
}
