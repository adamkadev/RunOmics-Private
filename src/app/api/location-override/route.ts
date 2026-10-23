import { NextResponse, type NextRequest } from 'next/server'
import { getLocationOverride } from '@/infrastructure/repositories/JsonLocationOverrideRepository'
import { loadData } from '@/application/usecases/LoadData'

const MAX_NAME_LENGTH = 120

export async function GET(req: NextRequest) {
  await loadData()
  const name = req.nextUrl.searchParams.get('name')
  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: 'A name is required' }, { status: 400 })
  }

  return NextResponse.json({ name: getLocationOverride(name) })
}
