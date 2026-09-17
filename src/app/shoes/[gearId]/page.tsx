import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SectionDivider } from '@/components/ui/SectionLabel'
import { getShoeDetail, type ShoeTypeBucket } from '@/application/usecases/GetShoeDetail'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getShoeVerdictInsight } from '@/application/usecases/GetShoeVerdictInsight'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import { wearOutlook, weeksInRotation, type WearStatus } from '@/domain/shoe/wearStatus'
import { ActivityListCard } from '@/components/activities/ActivityListCard'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { HERO_SURFACE } from '@/components/shoes/ShoesGrid'
import { StatusPill } from '@/components/ui/StatusPill'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { AnimatedValue } from '@/components/ui/AnimatedValue'
import { BackButton } from '@/components/ui/BackButton'
import { MetricGrid, type Metric } from '@/components/ui/MetricGrid'
import { STATUS } from '@/lib/statusColors'
import { ACTIVITY_TYPE_CONFIG } from '@/domain/activity/types'
import { formatDateRange, formatKm, formatMonthShortYear, formatPace } from '@/lib/formatters'
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

// Base/Tempo/Intervals borrows its three colours from the activity-type ramp
// rather than inventing a new one: Tempo and Anaerobic are already the
// mid/hard steps of that ramp, so the usage bar reads as the same intensity
// scale the rest of the app uses.
const TYPE_SHARE_COLOR: Record<ShoeTypeBucket, string> = {
  base: ACTIVITY_TYPE_CONFIG.Base.chartColor,
  tempo: ACTIVITY_TYPE_CONFIG.Tempo.chartColor,
  intervals: ACTIVITY_TYPE_CONFIG.Anaerobic.chartColor,
}

function typeShareLabel(bucket: ShoeTypeBucket): string {
  if (bucket === 'base') return t.activityTypes.Base
  if (bucket === 'tempo') return t.activityTypes.Tempo
  return t.shoes.detail.typeShareLabels.intervals
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
  const lastWornDate = shoe.activities[0]?.date ?? null
  const weeksWorn = weeksInRotation(shoe.firstUsedDate, lastWornDate)
  const avgRunKm = shoe.activities.length > 0 ? shoe.totalKm / shoe.activities.length : null
  const style = WEAR_STYLE[status]

  // A projection past a year out is six runs extrapolated into noise, not
  // information - the sentence drops the date it can't actually back up and
  // says only what's true at this rate.
  const FAR_OUT_WEEKS = 52
  const runOutSentence =
    !shoe.retired && weeksRemaining !== null && weeksRemaining > 0
      ? weeksRemaining > FAR_OUT_WEEKS
        ? d.projectedRunOutFar(Math.round(shoe.kmPerWeek), shoe.maxKm)
        : d.projectedRunOut(
            Math.round(shoe.kmPerWeek),
            shoe.maxKm,
            formatMonthShortYear(new Date(Date.now() + weeksRemaining * 7 * 86_400_000).toISOString().slice(0, 10)),
            weeksRemaining
          )
      : null

  // "Ran out its life" only fits a pair that actually reached the end of it -
  // one retired well short of its max km gets the honest percentage instead.
  const RAN_OUT_RATIO = 0.95
  const wearRatio = shoe.maxKm > 0 ? shoe.totalKm / shoe.maxKm : 0
  const reallyRanOut = wearRatio >= RAN_OUT_RATIO

  // "Fastest you've worn a pair through" only means something measured
  // against the rest of the retired fleet, and only for a pair that actually
  // ran its life out - a lone retired pair, a tie, or an early swap makes no
  // such claim.
  const isFastestRetirement =
    shoe.retired &&
    reallyRanOut &&
    weeksWorn > 0 &&
    (() => {
      const otherWeeks = getShoeStats()
        .filter((s) => s.retired && s.gearId !== shoe.gearId && s.firstUsedDate)
        .map((s) => weeksInRotation(s.firstUsedDate, s.lastUsedDate))
      return otherWeeks.length > 0 && otherWeeks.every((weeks) => weeksWorn < weeks)
    })()

  const era = shoe.firstUsedDate && lastWornDate ? formatDateRange(shoe.firstUsedDate, lastWornDate, { precision: 'month' }) : null

  const stats: Metric[] = [
    { value: <AnimatedValue value={shoe.activities.length} />, label: d.stats.activities, valueClassName: STAT_VALUE_CLASS },
    {
      // Always one decimal here, unlike formatDistance's two-under-10 rule:
      // an average is already a rounded fact, so "9.26 km" reads like false
      // precision that "9.3 km" doesn't.
      value: avgRunKm !== null ? avgRunKm.toFixed(1) : '-',
      unit: avgRunKm !== null ? t.units.km : undefined,
      label: d.stats.avgRun,
      valueClassName: STAT_VALUE_CLASS,
    },
    { value: <AnimatedValue value={shoe.kmPerWeek} decimals={0} />, label: d.stats.kmPerWeek, valueClassName: STAT_VALUE_CLASS },
    shoe.retired
      ? {
          value: shoe.avgPaceSecPerKm !== null ? formatPace(shoe.avgPaceSecPerKm) : '-',
          label: d.stats.avgPace,
          valueClassName: STAT_VALUE_CLASS,
        }
      : {
          value: shoe.firstUsedDate ? formatMonthShortYear(shoe.firstUsedDate) : '-',
          label: d.stats.firstRun,
          valueClassName: STAT_VALUE_CLASS,
        },
  ]

  const aiTake =
    status === 'ok' || shoe.retired
      ? null
      : await getShoeVerdictInsight({ shoe, status, kmLeft, weeksRemaining })

  // A bucket under ~3% is rounding noise from a handful of sessions, not a
  // real part of the mix - it earns neither a sliver of the bar nor a "0%"
  // line in the legend.
  const TYPE_SHARE_FLOOR = 3
  const typeShareEntries: { bucket: ShoeTypeBucket; percent: number }[] = (
    [
      { bucket: 'base', percent: shoe.typeShare.base },
      { bucket: 'tempo', percent: shoe.typeShare.tempo },
      { bucket: 'intervals', percent: shoe.typeShare.intervals },
    ] as const
  ).filter((entry) => entry.percent >= TYPE_SHARE_FLOOR)

  // The bar only ever shows three names - if any run in here is something
  // other than a plain Base or Tempo session, one of those three buckets is
  // quietly standing in for a type it never names.
  const typeShareIsGrouped = shoe.activities.some((a) => a.type !== 'Base' && a.type !== 'Tempo')

  // A retired pair's stat row already has "Avg pace" - this line only earns
  // its place by adding the one figure the row doesn't, so it drops pace and
  // keeps only HR. An active pair's stat row has no pace cell, so it keeps both.
  const usageSummary = shoe.retired
    ? shoe.avgHeartRate !== null
      ? d.whatItWasFor.summary(shoe.avgHeartRate)
      : null
    : shoe.avgPaceSecPerKm !== null && shoe.avgHeartRate !== null
      ? d.whatYouRunIn.summary(formatPace(shoe.avgPaceSecPerKm), shoe.avgHeartRate)
      : null

  // One threshold check, not a taxonomy: a pair either leans hard toward
  // quality work, leans toward easy miles, or says nothing distinctive.
  const keySessionShare = shoe.typeShare.tempo + shoe.typeShare.intervals
  const usageInsight = shoe.retired
    ? keySessionShare > 50
      ? d.whatItWasFor.keySessionPair(keySessionShare)
      : shoe.typeShare.base > 50
        ? d.whatItWasFor.easyPair(shoe.typeShare.base)
        : null
    : null

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

      {/* Km left is the hero, not a "Good / 62%" status row - the band already
          lives in the bar's colour, and the ratio is a quiet caption under it. */}
      {!shoe.retired && (
        <GlassSurface variant="card" className="p-5">
          <p className={cn('font-display text-display font-bold', style.text)}>{t.shoes.kmLeftExact(kmLeft)}</p>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
            <div
              className={`h-full rounded-full transition-all ${style.bar}`}
              style={{ width: `${shoe.wearPercent}%` }}
            />
          </div>
          <p className="mt-2.5 text-xs text-subtle">{t.shoes.kmOf(Math.round(shoe.totalKm), shoe.maxKm)}</p>
          {runOutSentence && <p className="mt-2.5 text-footnote leading-snug text-muted-foreground">{runOutSentence}</p>}
        </GlassSurface>
      )}

      {/* A retired shoe has no future to project, so its hero is the life it
          already lived - a total and an era, never a bar stuck at 100%. */}
      {shoe.retired && (
        <GlassSurface variant="card" className="p-5">
          <p className="font-display text-display font-bold text-foreground">
            {formatKm(shoe.totalKm)}
            <span className="ml-1 text-body font-semibold text-muted-foreground">{t.units.km}</span>
          </p>
          {era && <p className="mt-1 text-caption text-subtle">{era}</p>}
          <p className="mt-2.5 text-footnote leading-snug text-muted-foreground">
            {reallyRanOut
              ? isFastestRetirement
                ? d.retiredHero.ranOutFastest(shoe.maxKm, weeksWorn)
                : d.retiredHero.ranOut(shoe.maxKm, weeksWorn)
              : d.retiredHero.retiredEarly(Math.round(wearRatio * 100), shoe.maxKm, weeksWorn)}
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

      <MetricGrid metrics={stats} className="grid-cols-4 px-1 text-center" />

      <div className="space-y-2.5">
        <SectionDivider>{shoe.retired ? d.whatItWasFor.title : d.whatYouRunIn.title}</SectionDivider>
        {usageSummary && <p className="px-1 text-footnote font-medium text-foreground">{usageSummary}</p>}
        <div className="flex h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
          {typeShareEntries.map((entry) => (
            <span
              key={entry.bucket}
              style={{ width: `${entry.percent}%`, backgroundColor: TYPE_SHARE_COLOR[entry.bucket] }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-caption text-subtle">
          {typeShareEntries.map((entry) => (
            <span key={entry.bucket} className="flex items-center gap-1">
              <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: TYPE_SHARE_COLOR[entry.bucket] }} />
              {typeShareLabel(entry.bucket)} {entry.percent}%
            </span>
          ))}
        </div>
        {usageInsight && <p className="px-1 text-caption leading-snug text-foreground/75">{usageInsight}</p>}
        {typeShareIsGrouped && <p className="px-1 text-micro text-subtle-2">{d.typeShareGrouped}</p>}
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <SectionDivider>{shoe.retired ? d.activitiesTitleRetired : d.activitiesTitleActive}</SectionDivider>
          {shoe.activities.length > 0 && (
            <span className="shrink-0 text-caption text-subtle">{d.allActivitiesCount(shoe.activities.length)}</span>
          )}
        </div>
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
