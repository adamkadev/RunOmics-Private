import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getShoeComparison } from '@/application/usecases/GetShoeComparison'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { ShoesGrid, pickHeroShoe } from '@/components/shoes/ShoesGrid'
import { ShoeComparison } from '@/components/shoes/ShoeComparison'
import { BackButton } from '@/components/ui/BackButton'
import { formatKm } from '@/lib/formatters'
import { Plus } from 'lucide-react'
import { t } from '@/i18n'
import { GARMIN_GEAR_URL } from '@/components/shoes/shoeWear'
import { GlassLayers, GLASS_CIRCLE, glassClass } from '@/components/ui/GlassSurface'
import { loadData } from '@/application/usecases/LoadData'

const QUALITY_RUNS_WINDOW = 6

export const revalidate = 3600

export default async function ShoesPage() {
  await loadData()
  const shoes = getShoeStats()

  const hero = pickHeroShoe(shoes)
  const insights: Record<string, string> = {}
  if (hero) {
    const qualityRuns = getAllActivities()
      .filter((a) => a.type === 'Tempo' || a.type === 'Threshold')
      .slice(0, QUALITY_RUNS_WINDOW)
    const usedCount = qualityRuns.filter((a) => a.gearId === hero.gearId).length
    if (usedCount > 0) insights[hero.gearId] = t.shoes.hero.usage(usedCount, qualityRuns.length)
  }

  const comparison = getShoeComparison()

  return (
    <div className="space-y-6">
      <div>
        <BackButton label={t.pages.shoes.back} fallbackHref="/profile" />
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-display text-foreground">{t.pages.shoes.title}</h1>
            <p className="mt-0.5 text-footnote text-muted-foreground">
              {t.shoes.tracked(formatKm(shoes.reduce((sum, shoe) => sum + shoe.totalKm, 0)))}
            </p>
          </div>
          {/* Pairs come from Garmin; adding one happens there. */}
          <a
            href={GARMIN_GEAR_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={t.shoes.addLabel}
            // The compact top bar keeps this button once the page scrolls.
            data-bar-action="add"
            className={glassClass('regular', GLASS_CIRCLE)}
          >
            <GlassLayers />
            <Plus size={20} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
      </div>

      <ShoesGrid
        shoes={shoes}
        insights={insights}
        compare={comparison.length >= 2 ? <ShoeComparison rows={comparison} /> : undefined}
      />
    </div>
  )
}
