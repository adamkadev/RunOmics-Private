import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getShoeDetail } from '@/application/usecases/GetShoeDetail'
import { SHOE_REGISTRY } from '@/domain/shoe/types'
import { ActivityRow } from '@/components/activities/ActivityRow'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { Badge } from '@/components/ui/Card'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { BackButton } from '@/components/ui/BackButton'
import { STATUS } from '@/lib/statusColors'
import { formatCompactDate } from '@/lib/formatters'
import { t } from '@/i18n'

function wearTextClass(pct: number): string {
  if (pct >= 90) return STATUS.danger.text
  if (pct >= 70) return STATUS.warning.text
  return STATUS.success.text
}

function wearAlertBadge(pct: number): { label: string; className: string } | null {
  if (pct >= 90) return { label: t.shoes.criticalBadge, className: STATUS.danger.badge }
  if (pct >= 70) return { label: t.shoes.alertBadge, className: STATUS.warning.badge }
  return null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gearId: string }>
}): Promise<Metadata> {
  const { gearId } = await params
  const shoe = getShoeDetail(gearId)
  return { title: shoe?.name ?? t.pages.shoes.title }
}

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

  const d = t.shoes.detail
  const alertBadge = !shoe.retired ? wearAlertBadge(shoe.wearPercent) : null

  return (
    <div className="space-y-8">
      <div>
        <BackButton label={d.back} fallbackHref="/shoes" />
        <div className="flex items-center gap-2">
          <BrandIcon brand={shoe.brand} size={16} />
          <p className="widget-label text-muted-foreground">{shoe.brand}</p>
          {shoe.retired && <Badge className={STATUS.pending.badge}>{t.shoes.retired}</Badge>}
          {alertBadge && <Badge className={alertBadge.className}>{alertBadge.label}</Badge>}
        </div>
        <h1 className="text-display text-foreground">{shoe.name}</h1>
      </div>

      <GlassSurface variant="card" className="overflow-hidden">
        <div className="grid grid-cols-3 gap-2 px-4 py-4">
          <div className="flex flex-col items-center gap-1">
            <span className={`text-lg font-extrabold leading-none tracking-tight ${wearTextClass(shoe.wearPercent)}`}>
              <AnimatedValue value={shoe.totalKm} decimals={1} />
            </span>
            <span className="text-[10.5px] text-muted-foreground">{d.stats.distance}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-lg font-extrabold leading-none tracking-tight text-foreground">
              <AnimatedValue value={shoe.activities.length} />
            </span>
            <span className="text-[10.5px] text-muted-foreground">{d.stats.activities}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-lg font-extrabold leading-none tracking-tight text-foreground">
              {shoe.firstUsedDate ? formatCompactDate(shoe.firstUsedDate) : '-'}
            </span>
            <span className="text-[10.5px] text-muted-foreground">{d.stats.firstUsed}</span>
          </div>
        </div>
      </GlassSurface>

      <div className="space-y-3">
        <h2 className="widget-label text-muted-foreground">{d.activitiesTitle}</h2>
        {shoe.activities.length === 0 ? (
          <GlassSurface variant="card" className="flex flex-col items-center gap-2 rounded-card-sm border-dashed py-10 text-center">
            <p className="text-sm text-subtle">{d.empty}</p>
          </GlassSurface>
        ) : (
          <div className="space-y-2">
            {shoe.activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
