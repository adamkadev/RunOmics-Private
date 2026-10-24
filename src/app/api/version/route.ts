import { NextResponse } from 'next/server'
import { BUILD_COMMIT } from '@/lib/version'

export const dynamic = 'force-dynamic'

/** The deployment's own commit, for a page left open across a deploy to see it is behind. */
export function GET() {
  return NextResponse.json({ build: BUILD_COMMIT }, { headers: { 'Cache-Control': 'no-store' } })
}
