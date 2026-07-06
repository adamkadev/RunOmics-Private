import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { ShoesGrid } from '@/components/shoes/ShoesGrid'
import { ShoesSummary } from '@/components/shoes/ShoesSummary'
import { ShoeWearAlertLine } from '@/components/shoes/ShoeWearAlertLine'
import { BackButton } from '@/components/ui/BackButton'
import { t } from '@/i18n'

export default function ShoesPage() {
  const shoes = getShoeStats()

  return (
    <div className="space-y-6">
      <div>
        <BackButton label={t.pages.shoes.back} fallbackHref="/profile" />
        <h1 className="text-display text-foreground">{t.pages.shoes.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.shoes.subtitle}</p>
      </div>

      <ShoeWearAlertLine shoes={shoes} />
      <ShoesSummary shoes={shoes} />
      <ShoesGrid shoes={shoes} />
    </div>
  )
}
