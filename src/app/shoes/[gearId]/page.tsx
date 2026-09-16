import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SectionDivider } from '@/components/ui/SectionLabel'
import { getShoeDetail } from '@/application/usecases/GetShoeDetail'
import { getShoeVerdictInsight } from '@/application/usecases/GetShoeVerdictInsight'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import { wearOutlook, type WearStatus } from '@/domain/shoe/wearStatus'
import { ActivityListCard } from '@/components/activities/ActivityListCard'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { HERO_SURFACE } from '@/components/shoes/ShoesGrid'
import { StatusPill } from '@/components/ui/StatusPill'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { BackButton } from '@/components/ui/BackButton'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
import { STATUS } from '@/lib/statusColors'
import { formatDistance, formatMonthShortYear } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export const revalidate = 3600

// Mirrors WEAR_TEXT in ShoesGrid: `ok` reads neutral in text, while the filled
// bar keeps the healthy green so the graphic still says "plenty left".
const WEAR_STYLE: Record<WearStatus, { bar: string; text: string }> = {
  ok:      { bar: STATUS.success.dot, text: 'text-muted-foreground' },
  watch:   { bar: STATUS.warning.dot, text: STATUS.warning.text },
  replace: { bar: STATUS.danger.dot,  text: STATUS.danger.text },
}

function verdictBody(status: 'watch' | 'replace', weeksRemaining: number | null): string {
  const v = t.shoes.detail.verdict
  if (weeksRemaining === null) return v.noPaceData
  const action = status === 'replace' ? v.replaceNow : v.planReplacement
  return `${v.weeksLeft(weeksRemaining)} ${action}`
}

const STAT_VALUE_CLASS = 'text-subhead font-bold text-foreground'

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
  // km/week says nothing about a pair that is no longer worn, so a retired pair
  // spends that cell on the date it was last run in instead.
  const lastWornDate = shoe.activities[0]?.date ?? null
  const weeksInRotation = shoe.firstUsedDate
    ? Math.max(
        1,
        Math.round(
          (new Date((lastWornDate ?? shoe.firstUsedDate) + 'T00:00:00').getTime() -
            new Date(shoe.firstUsedDate + 'T00:00:00').getTime()) /
            (7 * 86_400_000)
        )
      )
    : 0
  const avgRunKm = shoe.activities.length > 0 ? shoe.totalKm / shoe.activities.length : null
  const style = WEAR_STYLE[status]
  const stats: Metric[] = [
    { value: <AnimatedValue value={shoe.activities.length} />, label: d.stats.activities, valueClassName: STAT_VALUE_CLASS },
    { value: <AnimatedValue value={weeksInRotation} />, label: d.stats.weeks, valueClassName: STAT_VALUE_CLASS },
    {
      value: avgRunKm !== null ? formatDistance(avgRunKm) : '-',
      unit: avgRunKm !== null ? t.units.km : undefined,
      label: d.stats.avgRun,
      valueClassName: STAT_VALUE_CLASS,
    },
    shoe.retired
      ? {
          value: lastWornDate ? formatMonthShortYear(lastWornDate) : '-',
          label: d.stats.lastWorn,
          valueClassName: STAT_VALUE_CLASS,
        }
      : {
          value: <AnimatedValue value={shoe.kmPerWeek} decimals={0} />,
          label: d.stats.kmPerWeek,
          valueClassName: STAT_VALUE_CLASS,
        },
    {
      value: shoe.firstUsedDate ? formatMonthShortYear(shoe.firstUsedDate) : '-',
      label: d.stats.firstUsed,
      valueClassName: STAT_VALUE_CLASS,
    },
  ]
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
          <SectionDivider>{shoe.brand}</SectionDivider>
          {shoe.retired && <StatusPill tone="zinc">{t.shoes.retired}</StatusPill>}
        </div>
        <h1 className="text-display text-foreground">{shoe.name}</h1>
      </div>

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

      <MetricGrid metrics={stats} className="grid-cols-5 px-1 text-center" />

      <div className="space-y-3">
        <SectionDivider>{d.activitiesTitle}</SectionDivider>
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
