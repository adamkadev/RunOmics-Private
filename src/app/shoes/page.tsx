import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { ShoesGrid } from '@/components/shoes/ShoesGrid'
import { ShoesSummary } from '@/components/shoes/ShoesSummary'
import { ShoeWearAlertLine } from '@/components/shoes/ShoeWearAlertLine'
import { t } from '@/i18n'

export const revalidate = 60

export default function ShoesPage() {
  const shoes = getShoeStats()

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.pages.shoes.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.pages.shoes.subtitle}</p>
      </div>

      <ShoeWearAlertLine shoes={shoes} />
      <ShoesSummary shoes={shoes} />
      <ShoesGrid shoes={shoes} />
    </div>
  )
}
