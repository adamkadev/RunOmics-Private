import { MapPin } from 'lucide-react'
import { getAllRoutes } from '@/application/usecases/GetAllRoutes'
import { GlobalMapWrapper } from '@/components/map/GlobalMapWrapper'
import { t } from '@/i18n'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: t.nav.items.heatmap }

export default function MapPage() {
  const data = getAllRoutes()
  const yearLabel = data.years.length > 1
    ? `${data.years[0]}–${data.years[data.years.length - 1]}`
    : data.years[0]

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col gap-3 lg:h-[calc(100dvh-2rem)]">
      {/* Stats strip */}
      <div className="flex flex-wrap items-center gap-4 px-1 pt-[max(env(safe-area-inset-top),12px)] lg:pt-0">
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-accent-text" />
          <h1 className="text-sm font-semibold text-foreground">{t.pages.map.title}</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-subtle">
          <span>{t.pages.map.routes(data.totalCount)}</span>
          <span className="h-3 w-px bg-border" />
          <span>{data.totalKm.toLocaleString()} {t.units.km}</span>
          <span className="h-3 w-px bg-border" />
          <span>{yearLabel}</span>
        </div>
      </div>

      {/* Map fills the rest */}
      <div className="flex-1 overflow-hidden rounded-xl border border-border shadow-card">
        <GlobalMapWrapper data={data} />
      </div>
    </div>
  )
}
