import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { guardInternalRequest, isAuthorizedCronRequest, isAuthorizedInternalRequest, type InternalAuthorizer } from '@/lib/internalAuth'

export async function handleInternalRoute(
  name: string,
  req: NextRequest,
  handler: () => Promise<NextResponse>,
  authorize: InternalAuthorizer = isAuthorizedInternalRequest
): Promise<NextResponse> {
  const denied = guardInternalRequest(req, authorize)
  if (denied) return denied

  try {
    return await handler()
  } catch (error) {
    console.error(`[internal:${name}]`, error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export type Trigger = 'cron' | 'manual'

/** GET is Vercel Cron's call, POST with the internal secret a run by hand. */
export function scheduledRoute(name: string, handler: (trigger: Trigger) => Promise<NextResponse>) {
  return {
    GET: (req: NextRequest) => handleInternalRoute(name, req, () => handler('cron'), isAuthorizedCronRequest),
    POST: (req: NextRequest) => handleInternalRoute(name, req, () => handler('manual')),
  }
}
