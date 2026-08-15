import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getShoeDetail } from '@/application/usecases/GetShoeDetail'
import { getShoeVerdictInsight } from '@/application/usecases/GetShoeVerdictInsight'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import { wearOutlook, type WearStatus } from '@/domain/shoe/wearStatus'
import { ActivityListCard } from '@/components/activities/ActivityListCard'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { HERO_SURFACE } from '@/components/shoes/ShoesGrid'
import { Badge } from '@/components/ui/Card'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { BackButton } from '@/components/ui/BackButton'
import { STATUS } from '@/lib/statusColors'
import { formatCompactMonthYear } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export const revalidate = 3600

const WEAR_STYLE: Record<WearStatus, { bar: string; text: string }> = {
  ok:      { bar: STATUS.success.dot, text: STATUS.success.text },
  watch:   { bar: STATUS.warning.dot, text: STATUS.warning.text },
  replace: { bar: STATUS.danger.dot,  text: STATUS.danger.text },
}

function verdictBody(status: 'watch' | 'replace', weeksRemaining: number | null): string {
  const v = t.shoes.detail.verdict
  if (weeksRemaining === null) return v.noPaceData
  const action = status === 'replace' ? v.replaceNow : v.planReplacement
  return `${v.weeksLeft(weeksRemaining)} ${action}`
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl bg-foreground/[0.04] px-2.5 py-2.5 text-center">
      <div className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-extrabold tabular-nums text-foreground">{value}</div>
    </div>
  )
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
  return Object.keys(getShoeRegistry()).map((gearId) => ({ gearId }))
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
  const { status, kmLeft, weeksRemaining } = wearOutlook(shoe)
  const style = WEAR_STYLE[status]
  const aiTake =
    status === 'ok' || shoe.retired
      ? null
      : await getShoeVerdictInsight({ shoe, status, kmLeft, weeksRemaining })

  return (
    <div className="space-y-6">
      <div>
        <BackButton label={d.back} fallbackHref="/shoes" />
        <div className="flex items-center gap-2">
          <BrandIcon brand={shoe.brand} size={16} />
          <p className="widget-label text-muted-foreground">{shoe.brand}</p>
          {shoe.retired && <Badge className={STATUS.pending.badge}>{t.shoes.retired}</Badge>}
        </div>
        <h1 className="text-display text-foreground">{shoe.name}</h1>
      </div>

      {!shoe.retired && status !== 'ok' && (
        <div className="rounded-2xl border p-4" style={HERO_SURFACE[status]}>
          <p className={cn('font-mono text-micro font-bold uppercase tracking-[0.1em]', style.text)}>
            {d.verdict.eyebrow(t.shoes.status[status])}
          </p>
          <p className="mt-2 font-display text-subhead font-bold leading-snug text-foreground">
            {aiTake?.headline ?? verdictBody(status, weeksRemaining)}
          </p>
          {aiTake && <p className="mt-1 text-footnote leading-snug text-muted-foreground">{aiTake.body}</p>}
        </div>
      )}

      {!shoe.retired && (
        <GlassSurface variant="card" className="p-5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className={cn('text-sm font-bold', style.text)}>{t.shoes.status[status]}</span>
            <span className={cn('text-sm font-bold tabular-nums', style.text)}>{shoe.wearPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
            <div
              className={`h-full rounded-full transition-all ${style.bar}`}
              style={{ width: `${shoe.wearPercent}%` }}
            />
          </div>
          <p className="mt-2.5 flex items-center justify-between text-xs text-subtle">
            <span>{t.shoes.kmOf(Math.round(shoe.totalKm), shoe.maxKm)}</span>
            <span className="font-medium">{t.shoes.kmLeft(kmLeft)}</span>
          </p>
        </GlassSurface>
      )}

      <div className="grid grid-cols-4 gap-2">
        <Stat value={<AnimatedValue value={shoe.totalKm} decimals={0} />} label={d.stats.distance} />
        <Stat value={<AnimatedValue value={shoe.activities.length} />} label={d.stats.activities} />
        <Stat value={<AnimatedValue value={shoe.kmPerWeek} decimals={0} />} label={d.stats.kmPerWeek} />
        <Stat value={shoe.firstUsedDate ? formatCompactMonthYear(shoe.firstUsedDate) : '-'} label={d.stats.firstUsed} />
      </div>

      <div className="space-y-3">
        <h2 className="widget-label text-muted-foreground">{d.activitiesTitle}</h2>
        {shoe.activities.length === 0 ? (
          <GlassSurface variant="card" className="rounded-card-sm border-dashed py-10 text-center">
            <p className="text-sm text-subtle">{d.empty}</p>
          </GlassSurface>
        ) : (
          <div className="space-y-2">
            {shoe.activities.map((activity) => (
              <ActivityListCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
