import { NextResponse, type NextRequest } from 'next/server'
import { guardInternalRequest } from '@/lib/internalAuth'

/**
 * Shared wrapper for /api/internal/* handlers: rate limit + secret check,
 * then run the handler with structured error logging. These endpoints are
 * called by unattended GitHub Actions crons, so a silent failure would
 * otherwise go unnoticed for weeks - every throw is logged with the route
 * name and returned as a 500 the workflow run can surface.
 */
export async function handleInternalRoute(
  name: string,
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const denied = guardInternalRequest(req)
  if (denied) return denied

  try {
    return await handler()
  } catch (error) {
    console.error(`[internal:${name}]`, error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
