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
    <div className="flex flex-col gap-3.5">
      {/* On a phone the heatmap is reached from Activities, and goes back
          there; on desktop it is a sidebar page of its own, with nothing to
          go back to (v4.17). */}
      <BackButton label={t.pages.map.back} fallbackHref="/activities" className="mb-0 self-start lg:hidden" />

      {/* The page title every other screen uses, with its facts under it; it
          was a 16 pt label off the title scale (G26). */}
      <div>
        <h1 className="text-display text-foreground">{t.pages.map.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground" aria-label={t.pages.map.title}>
          {[t.pages.map.runs(totalCount), `${totalKm.toLocaleString(t.locale)} ${t.units.km}`, yearLabel].join(' · ')}
        </p>
      </div>

      <GlobalMapWrapper data={data} />
    </div>
  )
}