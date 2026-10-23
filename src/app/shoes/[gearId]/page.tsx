import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getShoeDetail, type ShoeTypeBucket } from '@/application/usecases/GetShoeDetail'
import { getShoeStats } from '@/application/usecases/GetShoeStats'
import { getShoeVerdictInsight } from '@/application/usecases/GetShoeVerdictInsight'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import { wearOutlook, weeksInRotation } from '@/domain/shoe/wearStatus'
import { ShoeBackButton } from '@/components/shoes/ShoeBackButton'
import { cardClass } from '@/components/ui/Card'
import { Unit } from '@/components/ui/Stat'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { TypeDot } from '@/components/ui/TypeDot'
import { VerdictBlock, type VerdictTone } from '@/components/ui/Verdict'
import { zoneColor } from '@/lib/colors'
import Link from 'next/link'
import { GARMIN_GEAR_URL, WEAR_COLOR, shoeProjection, shoeWearCopy } from '@/components/shoes/shoeWear'
import { isWatchId } from '@/lib/garminConnect'
import { WearBar } from '@/components/shoes/WearBar'
import { formatClock, formatDate, formatDateRange, formatDistance, formatKm } from '@/lib/formatters'
import { t } from '@/i18n'
import { activityTitle, intendedType } from '@/lib/activityTitle'
import { loadData } from '@/application/usecases/LoadData'

export const revalidate = 3600

const TITLE = 'text-[15px] font-semibold text-foreground'

const VERDICT_TONE: Record<'watch' | 'replace', VerdictTone> = { watch: 'warn', replace: 'neg' }

// Activity-type colours, so each dot in the run list has its colour in the bar and legend.
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
  await loadData()
  const { gearId } = await params
  const shoe = getShoeDetail(gearId)
  return { title: shoe?.name ?? t.pages.shoes.title }
}

export async function generateStaticParams() {
  await loadData()
  return Object.keys(getShoeRegistry()).map((gearId) => ({ gearId }))
}

function formatMonthYear(iso: string): string {
  return formatDate(iso, { precision: 'month', year: 'always' })
}

export default async function ShoeDetailPage({
  params,
}: {
  params: Promise<{ gearId: string }>
}) {
  await loadData()
  const { gearId } = await params
  const shoe = getShoeDetail(gearId)
  if (!shoe) notFound()

  const d = t.shoes.detail
  const { status, kmLeft, weeksRemaining } = wearOutlook(shoe)
  const wear = shoeWearCopy(shoe)
  const lastWornDate = shoe.activities[0]?.date ?? null
  const weeksWorn = weeksInRotation(shoe.firstUsedDate, lastWornDate)
  const avgRunKm = shoe.activities.length > 0 ? shoe.totalKm / shoe.activities.length : null

  const runOutLine = shoeProjection(shoe, weeksRemaining)

  // "Ran out its life" only fits a pair worn to its max km; one retired well short gets the percentage.
  const RAN_OUT_RATIO = 0.95
  const wearRatio = shoe.maxKm > 0 ? shoe.totalKm / shoe.maxKm : 0
  const reallyRanOut = wearRatio >= RAN_OUT_RATIO

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

  // Under 3% is rounding noise from a handful of sessions: no sliver in the bar, no "0%" in the legend.
  const TYPE_SHARE_FLOOR = 3
  const typeShareEntries: { bucket: ShoeTypeBucket; percent: number }[] = (
    [
      { bucket: 'base', percent: shoe.typeShare.base },
      { bucket: 'tempo', percent: shoe.typeShare.tempo },
      { bucket: 'threshold', percent: shoe.typeShare.threshold },
      { bucket: 'intervals', percent: shoe.typeShare.intervals },
    ] as const
  ).filter((entry) => entry.percent >= TYPE_SHARE_FLOOR)

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
        <ShoeBackButton className="mb-3.5" />
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
          {/* Limits, roles and retirement are set on the watch, so Edit opens its app. */}
          {!shoe.retired && isWatchId(shoe.gearId) && (
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
              <span className="shrink-0 text-sm font-semibold text-foreground" style={wear.over ? { color: WEAR_COLOR[status] } : undefined} data-testid="shoe-left">
                {wear.over ? wear.short : wear.exact}
              </span>
            </div>
            <WearBar
              totalKm={shoe.totalKm}
              maxKm={shoe.maxKm}
              tickKm={shoe.alertThresholdKm}
              tickLabel={d.retireFromWorkouts(formatKm(shoe.alertThresholdKm))}
              limitLabel={d.limitTick(formatKm(shoe.maxKm))}
              size="md"
            />
            {runOutLine && <p className="text-xs leading-snug text-muted-foreground" data-testid="shoe-projection">{runOutLine}</p>}
          </>
        )}
        <dl className="mt-0.5 grid grid-cols-4 gap-2 border-t border-border pt-3.5" data-testid="shoe-hero-stats">
          {[
            { label: s.heroStats.runs, value: String(shoe.activities.length), unit: null },
            { label: s.heroStats.avgDistance, value: avgRunKm !== null ? formatKm(avgRunKm, 1) : '–', unit: avgRunKm !== null ? t.units.km : null },
            { label: s.heroStats.avgPace, value: shoe.avgPaceSecPerKm !== null ? formatClock(shoe.avgPaceSecPerKm) : '–', unit: shoe.avgPaceSecPerKm !== null ? t.units.perKm : null },
            { label: s.heroStats.avgHr, value: shoe.avgHeartRate !== null ? String(Math.round(shoe.avgHeartRate)) : '–', unit: shoe.avgHeartRate !== null ? t.units.bpm : null },
          ].map((stat) => (
            <div key={stat.label} className="flex min-w-0 flex-col gap-1">
              <dt className={`${EYEBROW_CLASS} truncate text-muted-foreground`}>{stat.label}</dt>
              <dd className="whitespace-nowrap text-[17px] font-semibold leading-tight tabular-nums text-foreground">
                {stat.value}
                {stat.unit && <Unit>{stat.unit}</Unit>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

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
            <Link href={`/activities?shoe=${shoe.gearId}`} className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-accent-text transition-opacity hover:opacity-80">
              {d.allActivitiesCount(shoe.activities.length)}
              <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
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
                <TypeDot type={intendedType(a)} size={8} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="break-words text-sm font-semibold text-pretty text-foreground">{activityTitle(a)}</span>
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
