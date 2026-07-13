import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getNextRace } from '@/application/usecases/GetNextRace'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { ShoesGrid, pickHeroShoe } from '@/components/shoes/ShoesGrid'
import { ShoesSummary } from '@/components/shoes/ShoesSummary'
import { BackButton } from '@/components/ui/BackButton'
import { formatDayMonth } from '@/lib/formatters'
import { t } from '@/i18n'

// Next race comes from public/data/upcoming_races.json (synced from Garmin);
// this ISR window bounds staleness between deploys.
export const revalidate = 86400

const QUALITY_RUNS_WINDOW = 6

export default async function ShoesPage() {
  const shoes = getShoeStats()

  // Deterministic rotation insight for the at-risk pair: how often it carried
  // the recent quality sessions, and whether a race is close enough to matter.
  const hero = pickHeroShoe(shoes)
  let heroInsight: string | null = null
  if (hero) {
    const qualityRuns = getAllActivities()
      .filter((a) => a.type === 'Tempo' || a.type === 'Threshold')
      .slice(0, QUALITY_RUNS_WINDOW)
    const usedCount = qualityRuns.filter((a) => a.gearId === hero.gearId).length
    const nextRace = await getNextRace()
    heroInsight =
      t.shoes.hero.usage(usedCount, qualityRuns.length) +
      (nextRace ? t.shoes.hero.rotateBeforeRace(formatDayMonth(nextRace.date)) : t.shoes.hero.rotate)
  }

  return (
    <div className="space-y-6">
      <div>
        <BackButton label={t.pages.shoes.back} fallbackHref="/profile" />
        <h1 className="text-display text-foreground">{t.pages.shoes.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.shoes.subtitle}</p>
      </div>

      <ShoesSummary shoes={shoes} />
      <ShoesGrid shoes={shoes} heroInsight={heroInsight} />
    </div>
  )
}
