import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse, after, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { dataRevalidationTag } from '@/application/usecases/DataRevalidation'
import { getActivities } from '@/application/usecases/GetActivities'
import { loadData } from '@/application/usecases/LoadData'
import { warmPages } from './warmPages'

export async function POST(req: NextRequest) {
  return handleInternalRoute('data-revalidate', req, async () => {
    const tag = dataRevalidationTag()
    if (!tag) {
      return NextResponse.json({ error: 'This deployment serves the data its build cloned' }, { status: 409 })
    }
    // expire: 0, so the next request renders the new commit instead of serving the old page once more.
    revalidateTag(tag, { expire: 0 })
    // Pages prerendered at build never read the tagged pointer.
    revalidatePath('/', 'layout')
    after(() =>
      warmPages(req.nextUrl.origin, async () => {
        await loadData()
        return getActivities()[0]?.id ?? null
      })
    )
    return NextResponse.json({ revalidated: true })
  })
}
