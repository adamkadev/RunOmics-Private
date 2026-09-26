import type { Metadata } from 'next'

import { getMapShellData } from '@/application/usecases/GetAllRoutes'
import { GlobalMapWrapper } from '@/components/map/GlobalMapWrapper'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: t.nav.items.heatmap,
}

export const revalidate = 3600

export default function MapPage() {
  const data = getMapShellData()
  const { years, totalCount, totalKm } = data

  const yearLabel =
    years.length > 1
      ? `${years[0]}–${years.at(-1)}`
      : years[0]

  return (
    <div className="flex h-[calc(100dvh-7rem-max(env(safe-area-inset-top),12px))] flex-col gap-3 lg:h-[calc(100dvh-2rem)]">
      <BackButton label={t.pages.map.back} fallbackHref="/activities" />

      {/* The page title every other screen uses, with its facts under it; it
          was a 16 pt label off the title scale (G26). */}
      <div>
        <h1 className="text-display text-foreground">{t.pages.map.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground" aria-label={t.pages.map.title}>
          {[t.pages.map.routes(totalCount), `${totalKm.toLocaleString(t.locale)} ${t.units.km}`, yearLabel].join(' · ')}
        </p>
      </div>

      <GlobalMapWrapper data={data} />
    </div>
  )
}