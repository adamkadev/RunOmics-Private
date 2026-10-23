import { NextResponse, type NextRequest } from 'next/server'
import { getExploreAreaFile } from '@/application/usecases/GetExploreAreas'
import { AREA_ID_PATTERN } from '@/domain/explore/areaFile'
import { loadData } from '@/application/usecases/LoadData'

/**
 * The file only changes with a deployment, which changes its version, so a request naming the current `?v=` can be
 * kept for good. `private` throughout: it outlines the athlete's home city, which no shared cache should hold.
 */

const IMMUTABLE = 'private, max-age=31536000, immutable'
const REVALIDATE = 'private, no-cache'

/** If-None-Match may list several tags, weak ones included, or be `*`. */
function matches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false
  return ifNoneMatch.split(',').some((tag) => {
    const trimmed = tag.trim()
    return trimmed === '*' || trimmed.replace(/^W\//, '') === etag
  })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await loadData()
  const { id } = await params
  const file = AREA_ID_PATTERN.test(id) ? getExploreAreaFile(id) : null
  if (!file) return NextResponse.json({ error: 'Unknown area' }, { status: 404 })

  const etag = `"${file.version}"`
  const headers = {
    etag,
    'cache-control': req.nextUrl.searchParams.get('v') === file.version ? IMMUTABLE : REVALIDATE,
  }
  if (matches(req.headers.get('if-none-match'), etag)) return new NextResponse(null, { status: 304, headers })

  return new NextResponse(file.body, {
    headers: { ...headers, 'content-type': 'application/geo+json; charset=utf-8' },
  })
}
