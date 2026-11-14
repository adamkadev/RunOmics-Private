import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getActivities } from '@/application/usecases/GetActivities'
import { getShoeComparison } from '@/application/usecases/GetShoeComparison'
import { getActivitiesWithEffectiveTypes } from '@/application/coaching/GetCoachingView'
import { ShoesGrid, pickHeroShoe } from '@/components/shoes/ShoesGrid'
import { ShoeComparison } from '@/components/shoes/ShoeComparison'
import { BackButton } from '@/components/ui/BackButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatDate, formatKm } from '@/lib/formatters'
import { Plus } from 'lucide-react'
import { t } from '@/i18n'
import { GARMIN_GEAR_URL } from '@/components/shoes/shoeWear'
import { GlassLayers, GLASS_CIRCLE, glassClass } from '@/components/ui/GlassSurface'
import { loadData } from '@/application/usecases/LoadData'
import { getOldShoeListDate } from '@/application/usecases/GetSyncStatus'

const QUALITY_RUNS_WINDOW = 6

export const revalidate = 3600

export default async function ShoesPage() {
  await loadData()
  const shoes = getShoeStats()

  const hero = pickHeroShoe(shoes)
  const insights: Record<string, string> = {}
  if (hero) {
    const qualityRuns = getActivitiesWithEffectiveTypes()
      .filter((a) => a.type === 'Tempo' || a.type === 'Threshold')
      .slice(0, QUALITY_RUNS_WINDOW)
    const usedCount = qualityRuns.filter((a) => a.gearId === hero.gearId).length
    if (usedCount > 0) insights[hero.gearId] = t.shoes.hero.usage(usedCount, qualityRuns.length)
  }

  const comparison = getShoeComparison()
  const listCheckedOn = shoes.length > 0 ? getOldShoeListDate() : null
  // Rounded as each page shows it, so the gap is All time's total minus this one.
  const shoeKm = Math.round(shoes.reduce((sum, shoe) => sum + shoe.totalKm, 0))
  const withoutShoe = Math.round(getActivities().reduce((sum, a) => sum + a.distanceKm, 0)) - shoeKm

  return (
    <div className="space-y-6">
      <PageHeader
        back={<BackButton label={t.pages.shoes.back} fallbackHref="/profile" />}
        title={t.pages.shoes.title}
        action={
          // Pairs come from Garmin; adding one happens there.
          <a
            href={GARMIN_GEAR_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={t.shoes.addLabel}
            // The compact top bar keeps this button once the page scrolls.
            data-bar-action="add"
            className={glassClass('bar', GLASS_CIRCLE)}
          >
            <GlassLayers />
            <Plus size={20} strokeWidth={2} aria-hidden="true" />
          </a>
        }
      >
        <p className="text-footnote text-muted-foreground">{t.shoes.tracked(formatKm(shoeKm), withoutShoe > 0 ? formatKm(withoutShoe) : null)}</p>
        {listCheckedOn && (
          <p className="text-footnote text-muted-foreground" data-testid="shoe-list-old">
            {t.shoes.listCheckedAt(formatDate(listCheckedOn))}
          </p>
        )}
      </PageHeader>

      <ShoesGrid
        shoes={shoes}
        insights={insights}
        compare={comparison.length >= 2 ? <ShoeComparison rows={comparison} /> : undefined}
      />
    </div>
  )
}
