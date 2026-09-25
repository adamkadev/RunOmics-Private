import { getHeatmapData } from '@/application/usecases/GetHeatmapData'
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'

export const revalidate = 3600

// Consistency is its own Progress page now, reached from the hub, rather than
// a card on it.
export default function ConsistencyPage() {
  return (
    <div className="space-y-5">
      <div>
        <BackButton label={t.pages.consistency.back} fallbackHref="/profile" />
        <h1 className="text-display text-foreground">{t.pages.consistency.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.consistency.subtitle}</p>
      </div>
      <ActivityHeatmap days={getHeatmapData()} />
    </div>
  )
}
