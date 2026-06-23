import { Activity } from 'lucide-react'
import { t } from '@/i18n'
import { GlassSurface } from '@/components/ui/GlassSurface'

// RunOmics is single-user: activities arrive via a manual Garmin export
// script (scripts/), not a live OAuth connection - no "Connected" status to
// show here, just where the data comes from.
export function DataSourceInfo() {
  return (
    <GlassSurface variant="card" className="rounded-[22px] p-5">
      <div className="flex items-center gap-3">
        <Activity size={16} className="shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">{t.settings.dataSource.title}</p>
          <p className="text-xs text-muted-foreground">
            {t.settings.dataSource.garmin} - {t.settings.dataSource.syncMethod}
          </p>
        </div>
      </div>
    </GlassSurface>
  )
}
