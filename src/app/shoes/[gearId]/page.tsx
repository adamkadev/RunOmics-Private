import { notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { Badge } from '@/components/ui/Card'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { ShoeDetailSummary } from '@/components/shoes/ShoeDetailSummary'
import { ShoeActivities } from '@/components/shoes/ShoeActivities'
import { getShoeDetail } from '@/application/usecases/GetShoeDetail'
import { SHOE_REGISTRY } from '@/domain/shoe/types'
import { t } from '@/i18n'

export async function generateStaticParams() {
  return Object.keys(SHOE_REGISTRY).map((gearId) => ({ gearId }))
}

export default async function ShoeDetailPage({
  params,
}: {
  params: Promise<{ gearId: string }>
}) {
  const { gearId } = await params
  const shoe = getShoeDetail(gearId)
  if (!shoe) notFound()

  return (
    <div className="space-y-5">
      <BackButton label={t.shoes.detail.back} fallbackHref="/shoes" />

      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <BrandIcon brand={shoe.brand} />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{shoe.brand}</p>
            {shoe.retired && <Badge className="bg-muted text-muted-foreground">{t.shoes.retired}</Badge>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{shoe.name}</h1>
        </div>
      </div>

      <ShoeDetailSummary shoe={shoe} />
      <ShoeActivities activities={shoe.activities} />
    </div>
  )
}
