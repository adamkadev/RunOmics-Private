import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { dataRevalidationTag } from '@/application/usecases/DataRevalidation'

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
    return NextResponse.json({ revalidated: true })
  })
}
