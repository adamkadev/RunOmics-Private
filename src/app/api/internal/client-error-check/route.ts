import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { sendPushToAllDevices } from '@/lib/sendPushNotification'
import { getClientErrorDigest } from '@/application/usecases/ClientErrors'
import { t } from '@/i18n'

export async function POST(req: NextRequest) {
  return handleInternalRoute('client-error-check', req, async () => {
    const { fresh, commit } = await getClientErrorDigest()
    if (fresh.length > 0) {
      const n = t.notifications.clientErrors
      await sendPushToAllDevices(n.title(fresh.length), n.body(fresh[0]!.message.slice(0, 80)))
    }
    await commit()
    // A count, not the messages: the sync prints this body into the Actions log.
    return NextResponse.json({ fresh: fresh.length })
  })
}
