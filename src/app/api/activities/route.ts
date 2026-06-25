import { NextResponse, type NextRequest } from 'next/server'
import { queryActivities, type ActivitySortKey, type ActivitySortOrder } from '@/application/usecases/QueryActivities'
import { ACTIVITY_TYPE_CONFIG, type ActivityType } from '@/domain/activity/types'

const SORT_KEYS: ActivitySortKey[] = ['date', 'distance', 'duration', 'pace', 'avgHr']
const ACTIVITY_TYPES = Object.keys(ACTIVITY_TYPE_CONFIG) as ActivityType[]
const MAX_LIMIT = 50

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  const typeParam = params.get('type')
  const type = ACTIVITY_TYPES.includes(typeParam as ActivityType) ? (typeParam as ActivityType) : null

  const sortByParam = params.get('sortBy')
  const sortBy: ActivitySortKey = SORT_KEYS.includes(sortByParam as ActivitySortKey)
    ? (sortByParam as ActivitySortKey)
    : 'date'

  const sortOrder: ActivitySortOrder = params.get('sortOrder') === 'asc' ? 'asc' : 'desc'

  const offset = Math.max(0, Number(params.get('offset')) || 0)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get('limit')) || 20))

  const result = queryActivities({
    type,
    search: params.get('search') ?? '',
    sortBy,
    sortOrder,
    offset,
    limit,
  })

  return NextResponse.json(result)
}
