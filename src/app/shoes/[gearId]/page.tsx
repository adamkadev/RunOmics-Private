import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getShoeDetail, type ShoeTypeBucket } from '@/application/usecases/GetShoeDetail'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getShoeVerdictInsight } from '@/application/usecases/GetShoeVerdictInsight'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import { wearOutlook, weeksInRotation } from '@/domain/shoe/wearStatus'
import { BackButton } from '@/components/ui/BackButton'
import { cardClass } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { TypeDot } from '@/components/ui/TypeDot'
import { VerdictBlock, type VerdictTone } from '@/components/ui/Verdict'
import { zoneColor } from '@/lib/colors'
import Link from 'next/link'
import { GARMIN_GEAR_URL, WEAR_COLOR, shoeWearCopy } from '@/components/shoes/shoeWear'
import { WearBar } from '@/components/shoes/WearBar'
import { formatClock, formatDate, formatDateRange, formatDistance, formatKm, formatMonthShortYear } from '@/lib/formatters'
import { addDays, isoDate } from '@/lib/calendarDate'
import { t } from '@/i18n'

export const revalidate = 3600

const TITLE = 'text-[15px] font-semibold text-foreground'

/** Replace soon is a caution, Replace is bad (v4.17). */
const VERDICT_TONE: Record<'watch' | 'replace', VerdictTone> = { watch: 'warn', replace: 'neg' }

// The type mix wears the activity-type colours, so every dot in the run list
// has its colour in the bar and legend (v4.4.1): easy Z2, tempo Z3,
// threshold Z4, and the intervals, VO2 and race bucket Z5.
const BUCKET_COLOR: Record<ShoeTypeBucket, string> = {
  base: zoneColor(2),
  tempo: zoneColor(3),
  threshold: zoneColor(4),
  intervals: zoneColor(5),
}

function typeShareLabel(bucket: ShoeTypeBucket): string {
  if (bucket === 'base') return t.shoes.easy
  if (bucket === 'intervals') return t.shoes.detail.typeShareLabels.intervals
  return t.activityTypes[bucket === 'tempo' ? 'Tempo' : 'Threshold']
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
      { bucket: 'threshold', percent: shoe.typeShare.threshold },
      { bucket: 'intervals', percent: shoe.typeShare.intervals },
    ] as const
  ).filter((entry) => entry.percent >= TYPE_SHARE_FLOOR)

  // One threshold check, not a taxonomy: a pair either leans hard toward
  // quality work, leans toward easy miles, or says nothing distinctive.
  const keySessionShare = shoe.typeShare.tempo + shoe.typeShare.threshold + shoe.typeShare.intervals
  const usageInsight = shoe.retired
    ? keySessionShare > 50
      ? d.whatItWasFor.keySessionPair(keySessionShare)
      : shoe.typeShare.base > 50
        ? d.whatItWasFor.easyPair(shoe.typeShare.base)
        : null
    : null

  const s = t.shoes
  const runs = shoe.activities.slice(0, RECENT_RUNS)

  return (
    <div className="flex flex-col gap-3.5">
      <header className="mb-1.5">
        <BackButton label={d.back} fallbackHref="/profile" className="mb-3.5" />
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="shoe-eyebrow">
              {!shoe.retired && shoe.firstUsedDate ? s.since(shoe.brand, formatMonthYear(shoe.firstUsedDate)) : shoe.brand}
              {shoe.retired && (
                <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-caption font-semibold text-muted-foreground">{s.retired}</span>
              )}
            </p>
            <h1 className="mt-1 text-display text-foreground">{shoe.name}</h1>
          </div>
          {/* Limits, roles and retirement are Garmin's: Edit opens its gear page. */}
          {!shoe.retired && (
            <a
              href={GARMIN_GEAR_URL}
              target="_blank"
              rel="noreferrer"
              aria-label={s.editLabel}
              className="hit-44 inline-flex h-[34px] shrink-0 items-center rounded-[9px] border border-[var(--line-2)] bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--surface-2)]"
            >
              {s.edit}
            </a>
          )}
        </div>
      </header>

      {/* One hero: where the pair is in its life, and its four numbers. */}
      <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="shoe-hero">
        {shoe.retired ? (
          <>
            <p className="text-[32px] font-semibold leading-none tracking-[-0.02em] text-foreground">
              {formatKm(shoe.totalKm)}
              <span className="ml-1.5 text-sm font-normal tracking-normal text-muted-foreground">{t.units.km}{era ? ` · ${era}` : ''}</span>
            </p>
            <WearBar totalKm={shoe.totalKm} maxKm={shoe.maxKm} retired size="md" />
            <p className="text-xs leading-snug text-muted-foreground">
              {reallyRanOut
                ? isFastestRetirement
                  ? d.retiredHero.ranOutFastest(formatKm(shoe.maxKm), weeksWorn)
                  : d.retiredHero.ranOut(formatKm(shoe.maxKm), weeksWorn)
                : d.retiredHero.retiredEarly(Math.round(wearRatio * 100), formatKm(shoe.maxKm), weeksWorn)}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[32px] font-semibold leading-none tracking-[-0.02em] text-foreground">
                {formatKm(shoe.totalKm)}
                <span className="ml-1.5 text-sm font-normal tracking-normal text-muted-foreground">{s.ofLimit(formatKm(shoe.maxKm))}</span>
              </p>
              {/* Past the limit, the overrun is the news, in the wear's colour. */}
              <span className="shrink-0 text-sm font-semibold text-foreground" style={wear.over ? { color: WEAR_COLOR[status] } : undefined} data-testid="shoe-left">
                {wear.over ? wear.short : wear.exact}
              </span>
            </div>
            <WearBar totalKm={shoe.totalKm} maxKm={shoe.maxKm} tickKm={shoe.alertThresholdKm} size="md" />
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs leading-snug text-muted-foreground">
              <span>{runOutSentence}</span>
              <span className="shrink-0" data-testid="shoe-retire-mark">{d.retireFromWorkouts(formatKm(shoe.alertThresholdKm))}</span>
            </div>
          </>
        )}
        <div className="mt-0.5 grid grid-cols-2 gap-4 border-t border-border pt-3.5 sm:grid-cols-4" data-testid="shoe-hero-stats">
          <Stat label={s.heroStats.runs} value={shoe.activities.length} />
          <Stat label={s.heroStats.avgDistance} value={avgRunKm !== null ? formatKm(avgRunKm, 1) : '–'} unit={avgRunKm !== null ? t.units.km : null} />
          <Stat label={s.heroStats.avgPace} value={shoe.avgPaceSecPerKm !== null ? formatClock(shoe.avgPaceSecPerKm) : '–'} unit={shoe.avgPaceSecPerKm !== null ? t.units.perKm : null} />
          <Stat label={s.heroStats.avgHr} value={shoe.avgHeartRate !== null ? Math.round(shoe.avgHeartRate) : '–'} unit={shoe.avgHeartRate !== null ? t.units.bpm : null} />
        </div>
      </section>

      {/* The standard verdict (v4.17): a status eyebrow on a plain card, no tint. */}
      {!shoe.retired && status !== 'ok' && (
        <section className={cardClass()} data-testid="shoe-verdict">
          <VerdictBlock
            tone={VERDICT_TONE[status]}
            eyebrow={t.shoes.status[status]}
            headline={aiTake?.headline ?? verdictBody(status, weeksRemaining)}
            body={aiTake?.body}
          />
        </section>
      )}

      {typeShareEntries.length > 0 && (
        <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="shoe-type-mix">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={TITLE}>{shoe.retired ? d.whatItWasFor.title : d.whatYouRunIn.title}</h2>
            <span className="shrink-0 text-xs text-muted-foreground">{s.shareOfDistance}</span>
          </div>
          {/* The session categories' zone colours (v4.4.1): each run dot below has its colour here. */}
          <div className="flex h-2.5 gap-[3px]">
            {typeShareEntries.map((entry) => (
              <span key={entry.bucket} data-bucket={entry.bucket} className="h-full rounded-full" style={{ flexGrow: entry.percent, flexBasis: 0, background: BUCKET_COLOR[entry.bucket] }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-muted-foreground">
            {typeShareEntries.map((entry) => (
              <span key={entry.bucket} className="flex items-center gap-1.5">
                <span aria-hidden className="size-[7px] rounded-full" style={{ background: BUCKET_COLOR[entry.bucket] }} />
                {typeShareLabel(entry.bucket)} <b className="font-semibold text-foreground">{entry.percent}%</b>
              </span>
            ))}
          </div>
          {usageInsight && <p className="text-[13px] leading-snug text-[var(--text-2)]">{usageInsight}</p>}
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2 px-1 pt-2">
          <h2 className={TITLE}>{shoe.retired ? s.lastRuns : d.activitiesTitleActive}</h2>
          {shoe.activities.length > RECENT_RUNS && (
            <Link href={`/activities?shoe=${shoe.gearId}`} className="shrink-0 text-[13px] font-medium text-accent-text transition-opacity hover:opacity-80">
              {d.allActivitiesCount(shoe.activities.length)} →
            </Link>
          )}
        </div>
        {runs.length === 0 ? (
          <section className={cardClass({ dashed: true, className: 'py-10 text-center' })}>
            <p className="text-sm text-subtle">{d.empty}</p>
          </section>
        ) : (
          <div className={cardClass({ padding: 'none', overflow: true })} data-testid="shoe-runs">
            {runs.map((a) => (
              <Link
                key={a.id}
                href={`/activities/${a.id}`}
                className="flex items-center gap-3 border-b border-border px-5 py-[13px] transition-colors last:border-b-0 hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]"
              >
                <TypeDot type={a.type} size={8} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-foreground">{a.description || t.activity.runTitle(a.dayOfWeek)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[formatDate(a.date), a.rpe !== null ? t.activities.row.rpeValue(a.rpe) : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-sm font-semibold text-foreground">
                    {formatDistance(a.distanceKm)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{t.units.km}</span>
                  </span>
                  {a.paceSecPerKm !== null && (
                    <span className="text-xs text-muted-foreground">{formatClock(a.paceSecPerKm)} {t.units.perKm}</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
