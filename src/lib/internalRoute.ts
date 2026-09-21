import { NextResponse, type NextRequest } from 'next/server'
import { guardInternalRequest } from '@/lib/internalAuth'

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
