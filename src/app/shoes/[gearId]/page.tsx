import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { getShoeDetail, type ShoeTypeBucket } from '@/application/usecases/GetShoeDetail'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getShoeVerdictInsight } from '@/application/usecases/GetShoeVerdictInsight'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import { wearOutlook, weeksInRotation, type WearStatus } from '@/domain/shoe/wearStatus'
import { HERO_SURFACE } from '@/components/shoes/ShoesGrid'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { BackButton } from '@/components/ui/BackButton'
import { STATUS } from '@/lib/statusColors'
import { sessionZone, zoneColor } from '@/lib/colors'
import { GARMIN_GEAR_URL } from '@/components/shoes/shoeWear'
import type { ActivityType } from '@/domain/activity/types'
import Link from 'next/link'
import { shoeWearCopy } from '@/components/shoes/shoeWear'
import { WearBar } from '@/components/shoes/WearBar'
import { formatClock, formatDate, formatDateRange, formatDistance, formatKm, formatMonthShortYear } from '@/lib/formatters'
import { addDays, isoDate } from '@/lib/calendarDate'
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

// The type mix wears the activity-type colours, so it matches the run dots
// everywhere (C5, v4.4b): easy the Z2 blue, tempo and threshold Z4, the
// intervals, VO2 and race bucket Z5.
const BUCKET_COLOR: Record<ShoeTypeBucket, string> = {
  base: zoneColor(2),
  tempo: zoneColor(4),
  intervals: zoneColor(5),
}

function bucketType(bucket: ShoeTypeBucket, activities: { type: ActivityType }[]): ActivityType {
  if (bucket === 'base') return 'Base'
  if (bucket === 'intervals') return 'Anaerobic'
  const threshold = activities.filter((a) => a.type === 'Threshold').length
  const tempo = activities.filter((a) => a.type === 'Tempo').length
  return threshold >= tempo ? 'Threshold' : 'Tempo'
}

function typeShareLabel(bucket: ShoeTypeBucket, activities: { type: ActivityType }[]): string {
  if (bucket === 'base') return t.shoes.easy
  if (bucket === 'intervals') return t.shoes.detail.typeShareLabels.intervals
  return t.activityTypes[bucketType(bucket, activities)]
}

/** Runs listed on the page; the rest are one link away, in Activities. */
const RECENT_RUNS = 5

function verdictBody(status: 'watch' | 'replace', weeksRemaining: number | null): string {
  const v = t.shoes.detail.verdict
  if (weeksRemaining === null) return v.noPaceData
  const action = status === 'replace' ? v.replaceNow : v.planReplacement
  return `${v.weeksLeft(weeksRemaining)} ${action}`
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

/**
 * The month this pair runs out at the current rate.
 *
 * The clock is read here rather than in the component body. The page is ISR, so
 * the answer is baked once per regeneration either way and the month label is
 * stable for far longer than that - but a render that asks what time it is has
 * no fixed output, which is what react-hooks/purity objects to, and a date
 * computed during render is also the one that drifts between a prerender and a
 * rehydrate.
 */
/** "Mar 2026": when a pair came into rotation, for its eyebrow. */
function formatMonthYear(iso: string): string {
  return formatDate(iso, { precision: 'month', year: 'always' })
}

function projectedRunOutMonth(weeksRemaining: number, now = new Date()): string {
  return formatMonthShortYear(isoDate(addDays(now, weeksRemaining * 7)))
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
  const wear = shoeWearCopy(shoe)
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
        ? d.projectedRunOutFar(Math.round(shoe.kmPerWeek), formatKm(shoe.maxKm))
        : d.projectedRunOut(
            Math.round(shoe.kmPerWeek),
            formatKm(shoe.maxKm),
            projectedRunOutMonth(weeksRemaining),
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

  const s = t.shoes
  const runs = shoe.activities.slice(0, RECENT_RUNS)
  const heroStats = [
    [String(shoe.activities.length), s.heroStats.runs],
    [avgRunKm !== null ? avgRunKm.toFixed(1) : '–', s.heroStats.kmAvg],
    [shoe.avgPaceSecPerKm !== null ? formatClock(shoe.avgPaceSecPerKm) : '–', s.heroStats.pace],
    [shoe.avgHeartRate !== null ? String(Math.round(shoe.avgHeartRate)) : '–', s.heroStats.bpm],
  ]

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <BackButton label={d.back} fallbackHref="/shoes" className="mb-0" />
          {!shoe.retired && (
            <a
              href={GARMIN_GEAR_URL}
              target="_blank"
              rel="noreferrer"
              aria-label={s.editLabel}
              className="flex h-11 items-center px-1 text-body font-bold text-muted-foreground transition-opacity active:opacity-70"
            >
              {s.edit}
            </a>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-caption uppercase tracking-[0.08em] text-muted-foreground" data-testid="shoe-eyebrow">
            {!shoe.retired && shoe.firstUsedDate ? s.since(shoe.brand, formatMonthYear(shoe.firstUsedDate)) : shoe.brand}
          </p>
          {shoe.retired && (
            <span className="rounded-md bg-[var(--segmented-track)] px-2 py-0.5 text-caption font-semibold text-muted-foreground">{s.retired}</span>
          )}
        </div>
        <h1 className="text-display text-foreground">{shoe.name}</h1>
      </div>

      {/* One hero: where the pair is in its life, and its four numbers. */}
      <GlassSurface variant="card" className="rounded-card-sm px-4 py-4" data-testid="shoe-hero">
        {shoe.retired ? (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-title1 font-bold leading-none tabular-nums text-foreground">{formatKm(shoe.totalKm)}</span>
              <span className="text-body text-muted-foreground">{t.units.km}{era ? ` · ${era}` : ''}</span>
            </p>
            <WearBar totalKm={shoe.totalKm} maxKm={shoe.maxKm} retired className="mt-3" />
            <p className="mt-2.5 text-footnote leading-snug text-muted-foreground">
              {reallyRanOut
                ? isFastestRetirement
                  ? d.retiredHero.ranOutFastest(shoe.maxKm, weeksWorn)
                  : d.retiredHero.ranOut(shoe.maxKm, weeksWorn)
                : d.retiredHero.retiredEarly(Math.round(wearRatio * 100), shoe.maxKm, weeksWorn)}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="flex items-baseline gap-2">
                <span className="font-display text-title1 font-bold leading-none tabular-nums text-foreground">{formatKm(shoe.totalKm)}</span>
                <span className="text-body text-muted-foreground">{s.ofLimit(formatKm(shoe.maxKm))}</span>
              </p>
              <span className={cn('shrink-0 font-display text-body font-bold tabular-nums', wear.over ? style.text : 'text-foreground')}>
                {wear.over ? wear.short : s.left(formatKm(kmLeft))}
              </span>
            </div>
            <WearBar totalKm={shoe.totalKm} maxKm={shoe.maxKm} className="mt-3" />
            {runOutSentence && <p className="mt-2.5 text-footnote leading-snug text-muted-foreground">{runOutSentence}</p>}
          </>
        )}
        <div className="mt-3.5 grid grid-cols-4 gap-2 border-t border-border pt-3" data-testid="shoe-hero-stats">
          {heroStats.map(([value, label]) => (
            <div key={label} className="min-w-0">
              <p className="font-display text-body font-bold leading-none tabular-nums text-foreground">{value}</p>
              <p className="mt-1 truncate text-caption text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </GlassSurface>

      {!shoe.retired && status !== 'ok' && (
        <div className="rounded-2xl border p-4" style={HERO_SURFACE[status]}>
          <p className={cn(EYEBROW_CLASS, style.text)}>
            {d.verdict.eyebrow(t.shoes.status[status])}
          </p>
          <p className="mt-2 font-display text-subhead font-bold leading-snug text-foreground">
            {aiTake?.headline ?? verdictBody(status, weeksRemaining)}
          </p>
          {aiTake && <p className="mt-1 text-footnote leading-snug text-muted-foreground">{aiTake.body}</p>}
        </div>
      )}

      {typeShareEntries.length > 0 && (
        <GlassSurface variant="card" className="rounded-card-sm px-4 py-4" data-testid="shoe-type-mix">
          <h2 className="font-display text-body font-bold text-foreground">{shoe.retired ? d.whatItWasFor.title : d.whatYouRunIn.title}</h2>
          <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {typeShareEntries.map((entry) => (
              <span key={entry.bucket} data-bucket={entry.bucket} className="h-full" style={{ flexGrow: entry.percent, flexBasis: 0, background: BUCKET_COLOR[entry.bucket] }} />
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-footnote font-semibold text-foreground">
            {typeShareEntries.map((entry) => (
              <span key={entry.bucket} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full" style={{ background: BUCKET_COLOR[entry.bucket] }} />
                {typeShareLabel(entry.bucket, shoe.activities)} {entry.percent}%
              </span>
            ))}
          </div>
          {usageInsight && <p className="mt-2 text-footnote leading-snug text-muted-foreground">{usageInsight}</p>}
          <p className="mt-2 text-caption text-muted-foreground">{s.typeMixCaption}</p>
        </GlassSurface>
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 className="font-display text-body font-bold text-foreground">{shoe.retired ? s.lastRuns : d.activitiesTitleActive}</h2>
          {shoe.activities.length > RECENT_RUNS && (
            <Link href={`/activities?shoe=${shoe.gearId}`} className="shrink-0 text-footnote font-bold text-accent-text">
              {d.allActivitiesCount(shoe.activities.length)} →
            </Link>
          )}
        </div>
        {runs.length === 0 ? (
          <GlassSurface variant="card" className="rounded-card-sm border-dashed py-10 text-center">
            <p className="text-sm text-subtle">{d.empty}</p>
          </GlassSurface>
        ) : (
          <GlassSurface variant="card" className="divide-y divide-border overflow-hidden rounded-card-sm" data-testid="shoe-runs">
            {runs.map((a) => (
              <Link key={a.id} href={`/activities/${a.id}`} className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: zoneColor(sessionZone(a)) }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-body font-bold text-foreground">{a.description || t.activity.runTitle(a.dayOfWeek)}</span>
                  <span className="block truncate text-footnote text-muted-foreground">
                    {[formatDate(a.date), a.rpe !== null ? t.activities.row.rpeValue(a.rpe) : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-body font-bold tabular-nums text-foreground">
                    {formatDistance(a.distanceKm)} {t.units.km}
                  </span>
                  {a.paceSecPerKm !== null && (
                    <span className="block text-footnote tabular-nums text-muted-foreground">{formatClock(a.paceSecPerKm)}</span>
                  )}
                </span>
              </Link>
            ))}
          </GlassSurface>
        )}
      </section>
    </div>
  )
}
