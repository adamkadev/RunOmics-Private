import { NextResponse, type NextRequest } from 'next/server'
import { queryActivities, LONG_RUN_KIND, type ActivityQueryKind, type ActivitySortKey, type ActivitySortOrder } from '@/application/usecases/QueryActivities'
import { isActivityType } from '@/domain/activity/types'

function isQueryKind(value: string): value is ActivityQueryKind {
  return value === LONG_RUN_KIND || isActivityType(value)
}

const SORT_KEYS: ActivitySortKey[] = ['date', 'distance', 'duration', 'pace', 'avgHr']
const MAX_LIMIT = 50

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  // ?types=Threshold,VO2Max: the filter sheet's picks, or a chip's group.
  const types = (params.get('types') ?? '').split(',').filter(isQueryKind)

  const sortByParam = params.get('sortBy')
  const sortBy: ActivitySortKey = SORT_KEYS.includes(sortByParam as ActivitySortKey)
    ? (sortByParam as ActivitySortKey)
    : 'date'

  const sortOrder: ActivitySortOrder = params.get('sortOrder') === 'asc' ? 'asc' : 'desc'

  const offset = Math.max(0, Number(params.get('offset')) || 0)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get('limit')) || 20))

  const result = queryActivities({
    types,
    gearId: params.get('gear'),
    search: params.get('search') ?? '',
    sortBy,
    sortOrder,
    offset,
    limit,
  })

  return NextResponse.json(result)
}
