import type { Metadata } from 'next'

import { getMapShellData } from '@/application/usecases/GetAllRoutes'
import { getMapTerritory } from '@/application/usecases/GetMapTerritory'
import { GlobalMapWrapper } from '@/components/map/GlobalMapWrapper'
import { TerritoryBand } from '@/components/map/TerritoryBand'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: t.nav.items.heatmap,
}

export const revalidate = 3600

function Divider() {
  return <span aria-hidden className="h-3 w-px bg-border" />
}

export default function MapPage() {
  const data = getMapShellData()
  const { years, totalCount, totalKm } = data
  const territory = getMapTerritory()

  const yearLabel =
    years.length > 1
      ? `${years[0]}–${years.at(-1)}`
      : years[0]

  return (
    <div className="flex h-[calc(100dvh-7rem-max(env(safe-area-inset-top),12px))] flex-col gap-3 lg:h-[calc(100dvh-2rem)]">
      <BackButton label={t.pages.map.back} fallbackHref="/activities" />

      <div className="flex flex-wrap items-center gap-4 px-1">
        <h1 className="text-sm font-semibold text-foreground">
          {t.pages.map.title}
        </h1>

        <div
          className="flex items-center gap-3 text-xs text-subtle"
          aria-label={t.pages.map.title}
        >
          <span>{t.pages.map.routes(totalCount)}</span>

          <Divider />

          <span>
            {totalKm.toLocaleString(t.locale)} {t.units.km}
          </span>

          <Divider />

          <span>{yearLabel}</span>
        </div>
      </div>

      {territory && <TerritoryBand territory={territory} />}

      <div className="flex-1 overflow-hidden rounded-xl border border-border shadow-card">
        <GlobalMapWrapper data={data} />
      </div>
    </div>
  )
}