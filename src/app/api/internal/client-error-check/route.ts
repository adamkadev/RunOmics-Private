import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { getClientErrorDigest } from '@/application/usecases/ClientErrors'
import { opsStrings, sendOpsPush } from '@/lib/opsPush'
import { pushPaths } from '@/lib/pushLinks'

export async function POST(req: NextRequest) {
  return handleInternalRoute('client-error-check', req, async () => {
    const { fresh, commit } = await getClientErrorDigest()
    if (fresh.length > 0) {
      const n = opsStrings.clientErrors
      await sendOpsPush({
        title: n.title(fresh.length),
        body: n.body(fresh[0]!.message.slice(0, 80)),
        link: pushPaths.settings,
        tag: 'client-errors',
      })
    }
    await commit()
    // A count, not the messages: the sync prints this body into the Actions log.
    return NextResponse.json({ fresh: fresh.length })
  })
}
