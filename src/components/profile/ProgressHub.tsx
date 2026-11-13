import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight, Settings } from 'lucide-react'
import { GlassLayers, GLASS_CIRCLE, glassClass } from '@/components/ui/GlassSurface'
import { PageHeader } from '@/components/layout/PageHeader'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { formatDate, formatDecimal, formatDuration, formatKm, formatNumber, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import type { ProgressHubView } from './progressHubView'
import { shortDist } from '@/components/goals/shortDistance'
import { WEAR_COLOR } from '@/components/shoes/shoeWear'
import { CoachBlockName } from './CoachBlockName'
import { CHECKPOINT_HREF } from '@/components/checkpoint/checkpointHref'

const LINK_CARD = 'text-left transition-transform duration-100 ease-out active:scale-[0.98]'

function RaceCard({ race }: { race: ProgressHubView['race'] }) {
  const h = t.profile.hub
  const time = race ? (race.predictedSeconds ?? race.targetSeconds ?? null) : null
  return (
    <Link
      href={race?.hasPage ? '/race' : '/goals'}
      className={cardClass({ className: cn('flex items-center justify-between gap-3 px-4 py-3.5', LINK_CARD) })}
      style={{
        background: 'color-mix(in srgb, var(--accent) 12%, var(--card))',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)',
      }}
      data-testid="race-tile"
    >
      {race ? (
        <>
          <div className="flex min-w-0 flex-col gap-[3px]">
            <span className={cn(EYEBROW_CLASS, 'text-muted-foreground')} data-testid="race-eyebrow">
              {shortDist(race.distance)} · {formatDate(race.date, { style: 'bare', year: 'never' })} · {h.inDays(race.daysUntil)}
            </span>
            {race.name && <p className="break-words text-[15px] font-semibold text-foreground text-pretty" data-testid="race-name">{race.name}</p>}
          </div>
          {time !== null && (
            <div className="flex shrink-0 flex-col items-end gap-px">
              <span className="text-xl font-bold tabular-nums leading-tight text-foreground" data-testid={race.predictedSeconds !== null ? 'race-predicted' : 'race-target'}>
                {formatDuration(time)}
              </span>
              <span className="text-[11px] text-muted-foreground">{race.predictedSeconds !== null ? h.predictedShort : h.targetShort}</span>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{h.noRace}</p>
      )}
    </Link>
  )
}

function BlockCard({ block }: { block: NonNullable<ProgressHubView['block']> }) {
  const h = t.profile.hub
  return (
    <Link href="/plan" className={cardClass({ className: cn('flex flex-col gap-2.5 px-4 py-3.5', LINK_CARD) })} data-testid="block-tile">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className={cn(EYEBROW_CLASS, 'text-muted-foreground')}>{h.currentBlock}</span>
          <p className="break-words text-[15px] font-semibold text-foreground text-pretty" data-testid="block-name"><CoachBlockName fallback={block.name} general={block.general} /></p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" data-testid="block-week">
          {block.week === 0 ? t.plan.phase.leadIn : h.blockWeek(block.week, block.total)}
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      </div>
      <div aria-hidden className="flex gap-[3px]">
        {Array.from({ length: block.total }, (_, i) => (
          <span key={i} className={cn('h-[5px] flex-1 rounded-full', i < block.week ? 'bg-accent' : 'bg-[var(--line-2)]')} />
        ))}
      </div>
      {block.planned > 0 && (
        <span className="text-xs text-muted-foreground" data-testid="block-sessions">{h.blockSessions(block.done, block.planned)}</span>
      )}
    </Link>
  )
}

/** One line per page: its name, one value, a status word at most. The page behind it owns the detail. */
export function HubRow({
  href,
  label,
  value,
  detail,
  line,
  note,
  aside,
  valueColor,
  testId,
}: {
  href: string
  label: string
  value?: ReactNode
  detail?: ReactNode
  /** A 3 pt drawing of the row's data, under its name. */
  line?: ReactNode
  /** Beside the line, at the right. */
  note?: ReactNode
  /** In the value's place: a picture rather than a number. */
  aside?: ReactNode
  valueColor?: string
  testId: string
}) {
  return (
    <Link href={href} className="flex min-h-[52px] items-center gap-3 px-4 py-2.5 transition-colors active:bg-[var(--fill-4)]" data-testid={testId}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-[15px] text-foreground">{label}</span>
          {value !== undefined && value !== '' && (
            <span className="shrink-0 text-right text-[15px] font-semibold tabular-nums text-foreground" style={valueColor ? { color: valueColor } : undefined} data-testid={`${testId}-value`}>
              {value}
            </span>
          )}
        </span>
        {line && (
          <span className="mt-2 mb-1 flex items-center justify-between gap-3" data-testid={`${testId}-line`}>
            <span className="flex min-w-0 flex-1 items-center">{line}</span>
            {note && <span className="shrink-0 text-xs text-muted-foreground">{note}</span>}
          </span>
        )}
        {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
      {aside}
      <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-subtle" />
    </Link>
  )
}

/** A 3 pt bar, filled to `pct`, with a tick at `tickPct` when given. */
function DataBar({ pct, color, tickPct = null, testId }: { pct: number; color: string; tickPct?: number | null; testId?: string }) {
  return (
    <span aria-hidden className="relative block h-[3px] w-full rounded-full bg-[var(--line-2)]" data-testid={testId}>
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
      {tickPct !== null && <span className="absolute -top-[3px] h-[9px] w-[1.5px] -translate-x-1/2 rounded-full bg-[var(--text-2)]" style={{ left: `${tickPct}%` }} />}
    </span>
  )
}

/** The goal is the tick: past it, the bar runs on. */
function GoalBar({ km, goalKm }: { km: number; goalKm: number }) {
  const scale = Math.max(km, goalKm)
  return <DataBar pct={(km / scale) * 100} color="var(--text-2)" tickPct={(goalKm / scale) * 100} testId="goal-bar" />
}

const STREAK_DOTS = 10

/** The last ten weeks in the accent, a target week filled, this week a ring. */
function WeekDots({ strip }: { strip: ProgressHubView['consistency']['strip'] }) {
  return (
    <span aria-hidden className="flex items-center gap-[5px]" data-testid="consistency-dots">
      {strip.slice(-STREAK_DOTS).map((week) => (
        <span
          key={week.monday}
          data-hit={week.hit}
          className={cn('size-[7px] shrink-0 rounded-full', week.current ? 'border-[1.5px] border-accent' : week.hit ? 'bg-accent' : 'bg-[var(--line-2)]')}
        />
      ))}
    </span>
  )
}

function RouteThumb({ path }: { path: string }) {
  return (
    <svg viewBox="-4 -4 108 108" aria-hidden="true" className="h-10 w-16 shrink-0 rounded-lg bg-[var(--fill-3)]" preserveAspectRatio="xMidYMid meet" data-testid="home-runs-thumb">
      <path d={path} fill="none" stroke="var(--accent)" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function HubGroup({ title, children, testId }: { title: string; children: ReactNode; testId: string }) {
  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <h2 className={cn(EYEBROW_CLASS, 'px-1 text-muted-foreground')}>{title}</h2>
      <div className={cardClass({ padding: 'none', overflow: true, className: 'divide-y divide-border' })}>{children}</div>
    </section>
  )
}

export interface HubSlots {
  checkpoint?: { line: string; better: number | null; inProgress: { week: number; end: string } | null } | null
  explored?: { name: string; pct: number } | null
  homeRuns?: { runCount: number; lastDate: string; preview: string } | null
  /** A return from a break: the longest non-stop run against the next step. */
  comeback?: { minutes: number; goal: number | null } | null
}

function checkpointRow(checkpoint: NonNullable<HubSlots['checkpoint']>): { value?: string; detail?: string } {
  const h = t.profile.hub
  const cycle = checkpoint.inProgress
  if (checkpoint.better) return { value: h.better(checkpoint.better), detail: cycle ? h.checkpointLine(cycle.week, formatDate(cycle.end, { style: 'bare', year: 'never' })) : checkpoint.line }
  return cycle ? { value: h.checkpointWeek(cycle.week) } : { detail: checkpoint.line }
}

export function ProgressHub({ view, checkpoint = null, explored = null, homeRuns = null, comeback = null }: { view: ProgressHubView } & HubSlots) {
  const h = t.profile.hub
  const { hero, vo2max, consistency, shoes, allTime, records } = view
  const newest = records.reduce<(typeof records)[number] | null>((best, r) => (r.date && (!best?.date || r.date > best.date) ? r : best), null)
  const checkpointWords = checkpoint && checkpointRow(checkpoint)
  const shoe = shoes.find((s) => s.status !== 'ok') ?? shoes[0] ?? null
  const short = hero.projection && hero.goalKm !== null && hero.projection.yearKm < hero.goalKm

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title={t.nav.items.profile}
        className="mb-1.5"
        action={
          <Link
            href="/settings"
            aria-label={h.settings}
            data-testid="settings-gear"
            // The compact bar reads this to keep the gear at the top right once the page scrolls.
            data-bar-action="settings"
            className={glassClass('bar', cn(GLASS_CIRCLE, 'lg:hidden'))}
          >
            <GlassLayers />
            <Settings size={20} strokeWidth={2} aria-hidden="true" />
          </Link>
        }
      />

      {!view.race && view.block ? <BlockCard block={view.block} /> : <RaceCard race={view.race} />}

      <HubGroup title={h.groupSeason} testId="hub-season">
        {comeback && (
          <HubRow
            href="/records?tab=return"
            label={t.returnProgress.cardTitle}
            value={h.comebackValue(comeback.minutes)}
            line={<DataBar pct={comeback.goal === null ? 100 : (comeback.minutes / comeback.goal) * 100} color="var(--accent)" testId="comeback-bar" />}
            detail={comeback.goal === null ? h.comebackDone : h.comebackNext(comeback.goal)}
            testId="comeback-row"
          />
        )}
        <HubRow
          href={hero.goalKm !== null ? '/goals' : '/all-time'}
          label={hero.goalKm !== null ? h.goalsSeason : h.thisYear}
          value={hero.goalKm !== null ? h.kmOfGoal(formatKm(hero.km), formatKm(hero.goalKm)) : `${formatKm(hero.km)} ${t.units.km}`}
          line={hero.goalKm !== null && hero.km > 0 ? <GoalBar km={hero.km} goalKm={hero.goalKm} /> : undefined}
          detail={hero.projection && hero.goalKm !== null ? h.onPaceFor(formatKm(hero.projection.yearKm)) : undefined}
          valueColor={short ? 'var(--warn)' : undefined}
          testId="year-row"
        />
        {checkpoint && checkpointWords && (
          <HubRow
            href={CHECKPOINT_HREF}
            label={t.checkpoint.title}
            value={checkpointWords.value}
            valueColor={checkpoint.better ? 'var(--pos)' : undefined}
            detail={checkpointWords.detail}
            testId="checkpoint-row"
          />
        )}
        <HubRow
          href="/consistency"
          label={h.consistency}
          value={consistency.streakWeeks > 0 ? h.streakValue(consistency.streakWeeks) : h.noStreakShort}
          line={consistency.strip.length > 0 ? <WeekDots strip={consistency.strip} /> : undefined}
          note={consistency.strip.length > 0 ? h.runsThisWeek(consistency.thisWeek.runs, consistency.thisWeek.target) : undefined}
          detail={consistency.strip.length > 0 ? undefined : h.runsThisWeek(consistency.thisWeek.runs, consistency.thisWeek.target)}
          testId="consistency-row"
        />
      </HubGroup>

      <HubGroup title={h.groupYou} testId="hub-you">
        <HubRow
          href="/records"
          label={h.records}
          value={newest ? `${h.recordLabels[newest.key] ?? newest.label} ${formatDuration(newest.seconds)}` : records.length > 0 ? h.recordCount(records.length) : h.noRecords}
          detail={newest?.date ? h.newestRecord(formatDate(newest.date, { style: 'bare' })) : undefined}
          testId="records-row"
        />
        <HubRow href="/athlete" label={h.athleteZones} value={vo2max ? `${h.vo2max} ${formatDecimal(vo2max.value, 1)}` : ''} testId="athlete-row" />
        {explored && (
          <HubRow
            href="/activities?view=map&layer=districts"
            label={h.exploredIn(explored.name)}
            value={formatPercent(explored.pct)}
            line={<DataBar pct={explored.pct} color="var(--accent)" testId="explored-bar" />}
            testId="explored-row"
          />
        )}
        {homeRuns && (
          <HubRow
            href="/home-runs"
            label={t.homeRuns.title}
            detail={h.homeRunsDetail(formatNumber(homeRuns.runCount), formatDate(homeRuns.lastDate, { style: 'bare' }))}
            aside={<RouteThumb path={homeRuns.preview} />}
            testId="home-runs-row"
          />
        )}
      </HubGroup>

      <HubGroup title={h.groupGear} testId="hub-gear">
        {shoe && (
          <HubRow
            // Every pair, the worn one leading the list with its tag: its own page alone hid the others.
            href="/shoes"
            label={`${h.shoes} · ${shoe.name}`}
            value={shoe.status !== 'ok' ? t.shoes.status[shoe.status].toLocaleLowerCase(t.locale) : undefined}
            valueColor={shoe.status !== 'ok' ? WEAR_COLOR[shoe.status] : undefined}
            line={<DataBar pct={shoe.wearPct} color={WEAR_COLOR[shoe.status]} testId="shoes-bar" />}
            testId="shoes-row"
          />
        )}
        <HubRow href="/all-time" label={h.allTime} value={`${formatKm(allTime.km)} ${t.units.km}`} detail={t.common.runs(allTime.runs)} testId="all-time-row" />
      </HubGroup>
    </div>
  )
}
