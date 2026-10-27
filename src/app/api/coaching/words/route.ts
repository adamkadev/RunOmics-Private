import { NextResponse } from 'next/server'
import { getCoachWords } from '@/application/coaching/GetCoachWords'
import { loadData } from '@/application/usecases/LoadData'

// Fetched by the browser after load, so the coach's text sits behind the same gate as the page (src/proxy.ts) and never in ISR HTML.

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  await loadData()
  const words = getCoachWords()
  return NextResponse.json(words ? { available: true, ...words } : { available: false }, { headers: NO_STORE })
}
