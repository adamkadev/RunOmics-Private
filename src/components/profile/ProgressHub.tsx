import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight, Settings } from 'lucide-react'
import { GlassLayers, GLASS_CIRCLE, glassClass } from '@/components/ui/GlassSurface'
import { PageHeader } from '@/components/layout/PageHeader'
import { cardClass } from '@/components/ui/Card'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { formatDate, formatDecimal, formatDuration, formatKm, formatPercent } from '@/lib/formatters'
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
export function HubRow({ href, label, value, detail, valueColor, testId }: { href: string; label: string; value: ReactNode; detail?: ReactNode; valueColor?: string; testId: string }) {
  return (
    <Link href={href} className="flex min-h-[52px] items-center gap-3 px-4 py-2.5 transition-colors active:bg-[var(--fill-4)]" data-testid={testId}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] text-foreground">{label}</span>
        {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
      <span className="shrink-0 text-right text-[15px] font-semibold tabular-nums text-foreground" style={valueColor ? { color: valueColor } : undefined} data-testid={`${testId}-value`}>
        {value}
      </span>
      <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-subtle" />
    </Link>
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
  checkpoint?: { line: string; better: number | null } | null
  explored?: { name: string; pct: number; complete: number; total: number } | null
  homeRuns?: { runCount: number } | null
}

export function ProgressHub({ view, checkpoint = null, explored = null, homeRuns = null }: { view: ProgressHubView } & HubSlots) {
  const h = t.profile.hub
  const { hero, vo2max, consistency, shoes, allTime, records } = view
  const newest = records.find((r) => r.recent) ?? null
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
        <HubRow
          href={hero.goalKm !== null ? '/goals' : '/all-time'}
          label={hero.goalKm !== null ? h.goalsSeason : h.thisYear}
          value={hero.goalKm !== null ? h.kmOfGoal(formatKm(hero.km), formatKm(hero.goalKm)) : `${formatKm(hero.km)} ${t.units.km}`}
          detail={hero.projection && hero.goalKm !== null ? h.onPaceFor(formatKm(hero.projection.yearKm)) : undefined}
          valueColor={short ? 'var(--warn)' : undefined}
          testId="year-row"
        />
        {checkpoint && (
          <HubRow href={CHECKPOINT_HREF} label={t.checkpoint.title} value={checkpoint.better ? h.better(checkpoint.better) : ''} detail={checkpoint.line} testId="checkpoint-row" />
        )}
        <HubRow
          href="/consistency"
          label={h.consistency}
          value={consistency.streakWeeks > 0 ? h.streakValue(consistency.streakWeeks) : h.noStreakShort}
          detail={h.runsThisWeek(consistency.thisWeek.runs, consistency.thisWeek.target)}
          testId="consistency-row"
        />
      </HubGroup>

      <HubGroup title={h.groupYou} testId="hub-you">
        <HubRow
          href="/records"
          label={h.records}
          value={newest ? `${h.recordLabels[newest.key] ?? newest.label} ${formatDuration(newest.seconds)}` : records.length > 0 ? h.recordCount(records.length) : h.noRecords}
          detail={newest ? h.newRecordLabel : undefined}
          testId="records-row"
        />
        <HubRow
          href="/athlete"
          label={h.athleteZones}
          value={vo2max ? `${h.vo2max} ${formatDecimal(vo2max.value, 1)}` : ''}
          detail={vo2max?.grade ? [vo2max.grade.letter, vo2max.grade.topPercent != null ? t.vo2Grade.topPct(vo2max.grade.topPercent) : null].filter(Boolean).join(' · ') : undefined}
          testId="athlete-row"
        />
        {explored && (
          <HubRow href="/activities?view=map&layer=districts" label={h.exploredIn(explored.name)} value={formatPercent(explored.pct)} detail={h.exploredComplete(explored.complete, explored.total)} testId="explored-row" />
        )}
        {homeRuns && <HubRow href="/home-runs" label={t.homeRuns.title} value={t.common.runs(homeRuns.runCount)} testId="home-runs-row" />}
      </HubGroup>

      <HubGroup title={h.groupGear} testId="hub-gear">
        {shoe && (
          <HubRow
            href={shoe.status !== 'ok' ? `/shoes/${shoe.gearId}` : '/shoes'}
            label={`${h.shoes} · ${shoe.name}`}
            value={shoe.status !== 'ok' ? t.shoes.status[shoe.status].toLocaleLowerCase(t.locale) : `${formatKm(shoe.km)} / ${formatKm(shoe.maxKm)} ${t.units.km}`}
            valueColor={shoe.status !== 'ok' ? WEAR_COLOR[shoe.status] : undefined}
            testId="shoes-row"
          />
        )}
        <HubRow href="/all-time" label={h.allTime} value={`${formatKm(allTime.km)} ${t.units.km}`} detail={t.common.runs(allTime.runs)} testId="all-time-row" />
      </HubGroup>
    </div>
  )
}
