import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { isAuthorizedInternalRequest } from '@/lib/internalAuth'

type FirestoreCollection = 'goals' | 'pbs' | 'upcomingRaces' | 'athlete'

const TARGETS: Record<FirestoreCollection, { path: string; type?: 'page' }[]> = {
  goals: [{ path: '/goals' }],
  pbs: [{ path: '/' }, { path: '/activities' }, { path: '/activities/[id]', type: 'page' }, { path: '/records' }, { path: '/goals' }],
  upcomingRaces: [{ path: '/goals' }],
  athlete: [{ path: '/profile' }, { path: '/analytics' }],
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedInternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { collection } = (await req.json()) as { collection?: FirestoreCollection }
  const targets = collection ? TARGETS[collection] : undefined
  if (!targets) {
    return NextResponse.json({ error: 'Unknown collection' }, { status: 400 })
  }

  for (const { path, type } of targets) revalidatePath(path, type)

  return NextResponse.json({ revalidated: targets.map((t) => t.path) })
}
