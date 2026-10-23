import { t } from '@/i18n'
import { formatDistance, formatNumber } from '@/lib/formatters'
import type { TerritoryCardContent } from '@/components/map/TerritoryBand'
import type { AreaCoverage } from '@/domain/explore/types'
import type { DistrictsStatus } from './useDistrictsCoverage'

/** A stat with nothing to show yet. */
const NO_VALUE = '—'

/**
 * The card under the map while Districts is on (V2/V4): the heat card's
 * eyebrow, how many quartiers are complete and which is next, and - only
 * once there is a way to plan it (`onPlanRun`) - a button that does. Dashes
 * while the coverage is on its way, and a sentence marked pending, so the
 * card keeps its shape and its height.
 */
export function districtsCardContent(
  eyebrow: string,
  { coverage, status }: { coverage: AreaCoverage | null; status: DistrictsStatus },
  onPlanRun?: (unitId: string) => void,
): TerritoryCardContent {
  const d = t.pages.map.districts
  const next = coverage?.nextId ? (coverage.units.find((u) => u.id === coverage.nextId) ?? null) : null
  const distance = next?.distanceKm != null ? formatDistance(next.distanceKm) : null
  const headline = !coverage
    ? status === 'error'
      ? d.failed
      : d.loading
    : next
      ? d.headline(coverage.completeCount, coverage.unitCount, next.name, distance ? `${distance} ${t.units.km}` : null)
      : d.allComplete(coverage.unitCount)
  return {
    eyebrow,
    headline,
    stats: [
      {
        label: d.completeStat,
        value: coverage ? String(coverage.completeCount) : NO_VALUE,
        unit: coverage ? d.ofTotal(coverage.unitCount) : undefined,
      },
      {
        label: d.exploredStat,
        value: coverage ? formatNumber(coverage.exploredPct, 0) : NO_VALUE,
        unit: coverage ? t.units.percent : undefined,
      },
      { label: d.nextStat, value: distance ?? NO_VALUE, unit: distance ? t.units.km : undefined },
    ],
    action: next && onPlanRun ? { label: d.planRunIn(next.name), onClick: () => onPlanRun(next.id) } : undefined,
    ...(coverage ? {} : { pending: true }),
  }
}
