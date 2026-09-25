import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { ConsistencyMonths } from '@/components/consistency/ConsistencyMonths'
import { consistencyMonths } from '@/components/consistency/consistencyMonths'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'

export const revalidate = 3600

// Consistency is its own Progress page, reached from the hub: the rolling
// year as one row per month, a size a phone can read.
export default function ConsistencyPage() {
  const view = consistencyMonths(getHeatmapData())
  const p = t.pages.consistency
  return (
    <div className="space-y-3">
      <div>
        <BackButton label={p.back} fallbackHref="/profile" />
        <h1 className="text-display text-foreground">{p.title}</h1>
        <p className="mt-1 text-footnote text-muted-foreground">
          {view.range ? p.window(view.range) : p.rolling}
        </p>
      </div>
      <ConsistencyMonths view={view} />
    </div>
  )
}
