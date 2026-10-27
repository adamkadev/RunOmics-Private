import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { getClientErrorDigest } from '@/application/usecases/ClientErrors'
import { opsStrings, sendOpsPush } from '@/lib/opsPush'
import { pushPaths } from '@/lib/pushLinks'

export async function POST(req: NextRequest) {
  return handleInternalRoute('client-error-check', req, async () => {
    const { fresh, serverErrors, commit } = await getClientErrorDigest()
    if (fresh.length > 0 || serverErrors.length > 0) {
      const n = opsStrings.clientErrors
      const server = serverErrors[0]
      const latest = fresh[0] ? fresh[0].message.slice(0, 80) : n.serverError(server!.route, server!.error ?? `HTTP ${server!.status}`)
      await sendOpsPush({
        title: n.title(fresh.length, serverErrors.length),
        body: n.body(latest),
        link: pushPaths.settings,
        tag: 'client-errors',
      })
    }
    await commit()
    // Counts, not the messages: the sync prints this body into the Actions log.
    return NextResponse.json({ fresh: fresh.length, serverErrors: serverErrors.length })
  })
}
