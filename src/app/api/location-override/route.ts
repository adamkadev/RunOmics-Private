import { NextResponse, type NextRequest } from 'next/server'
import { getLocationOverride } from '@/infrastructure/repositories/JsonLocationOverrideRepository'

const MAX_NAME_LENGTH = 120

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: 'A name is required' }, { status: 400 })
  }

  return NextResponse.json({ name: getLocationOverride(name) })
}
