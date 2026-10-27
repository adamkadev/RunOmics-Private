import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Settings } from 'lucide-react'
import { GlassLayers, GLASS_CIRCLE, glassClass } from '@/components/ui/GlassSurface'
import { cardClass } from '@/components/ui/Card'
import { Stat, StatGrid } from '@/components/ui/Stat'
import { EYEBROW_CLASS } from '@/components/ui/SectionLabel'
import { formatDate, formatDecimal, formatDuration, formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { deltaColor } from '@/lib/deltaTone'
import { t } from '@/i18n'
import type { WearStatus } from '@/domain/shoe/wearStatus'
import type { ProgressHubView } from './progressHubView'
import { shortDist } from '@/components/goals/shortDistance'
import { WEAR_COLOR } from '@/components/shoes/shoeWear'
import { CoachBlockName } from './CoachBlockName'

const TITLE = 'text-headline text-foreground'
const LINK_CARD = 'text-left transition-transform duration-100 ease-out active:scale-[0.98]'

function Tile({ href, title, aside, className, children, testId }: { href: string; title: string; aside?: ReactNode; className?: string; children: ReactNode; testId?: string }) {
  return (
    <Link href={href} data-testid={testId} className={cardClass({ className: cn('flex flex-col gap-2.5', LINK_CARD, className) })}>
      <div className="flex items-center justify-between gap-2">
        <span className={TITLE}>{title}</span>
        {aside ?? <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />}
      </div>
      {children}
    </Link>
  )
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      {children}
      <ChevronRight size={14} aria-hidden="true" />
    </span>
  )
}

function Bar({ share, color, thin = false }: { share: number; color: string; thin?: boolean }) {
  return (
    <div className={cn('w-full overflow-hidden', thin ? 'h-1 rounded-[2px] bg-[var(--track)]' : 'h-1.5 rounded-full bg-[var(--surface-2)]')}>
      <div className={cn('h-full', thin ? 'rounded-[2px]' : 'rounded-full')} data-testid="bar-fill" style={{ width: `${Math.round(Math.min(1, Math.max(0, share)) * 1000) / 10}%`, background: color }} />
    </div>
  )
}

function projectionColor(hero: ProgressHubView['hero']): string {
  const projected = hero.projection?.yearKm
  if (projected === undefined || hero.goalKm === null) return 'var(--pos)'
  return projected < hero.goalKm ? 'var(--warn)' : 'var(--pos)'
}

function shoeColor(status: WearStatus): string {
  return WEAR_COLOR[status]
}

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
            <span className={cn(EYEBROW_CLASS, 'text-accent-text')} data-testid="race-eyebrow">
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
          <span className={cn(EYEBROW_CLASS, 'text-accent-text')}>{h.currentBlock}</span>
          <p className="break-words text-[15px] font-semibold text-foreground text-pretty" data-testid="block-name"><CoachBlockName fallback={block.name} general={block.general} /></p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" data-testid="block-week">
          {h.blockWeek(block.week, block.total)}
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

function YearCard({ view }: { view: ProgressHubView }) {
  const h = t.profile.hub
  const { hero } = view
  const projection = hero.projection
  const shortKm = projection && hero.goalKm !== null ? projection.yearKm - hero.goalKm : null
  const share = (km: number) => (hero.goalKm ? Math.min(1, Math.max(0, km / hero.goalKm)) * 100 : 0)
  return (
    <Link href={hero.goalKm !== null ? '/goals' : '/all-time'} className={cardClass({ className: cn('flex flex-col gap-[9px] px-4 py-3.5', LINK_CARD) })} data-testid="year-hero">
      <div className="flex items-center justify-between gap-2">
        <span className={TITLE}>{hero.goalKm !== null ? h.goalsSeason : h.thisYear}</span>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-bold leading-tight text-foreground">
          {formatKm(hero.km)}{' '}
          <span className="text-[13px] font-normal text-muted-foreground">{hero.goalKm !== null ? h.ofGoal(formatKm(hero.goalKm)) : t.units.km}</span>
        </p>
        {shortKm !== null && (
          <span className="text-right text-xs" style={{ color: projectionColor(hero) }} data-testid="projection-verdict">
            {shortKm < 0 ? h.shortAtPace(formatKm(-shortKm)) : shortKm > 0 ? h.overAtPace(formatKm(shortKm)) : h.onPace}
          </span>
        )}
      </div>
      {hero.goalKm !== null && (
        <div className="relative h-1.5 rounded-[3px] bg-[var(--track)]" data-testid="year-bar">
          <div className="absolute inset-y-0 left-0 rounded-[3px] bg-accent" style={{ width: `${share(hero.km)}%` }} />
          {projection && (
            <div className="absolute -top-[3px] h-3 w-0.5" style={{ left: `${share(projection.yearKm)}%`, background: projectionColor(hero) }} data-testid="projection-tick" />
          )}
        </div>
      )}
    </Link>
  )
}

function Records({ records, vo2max }: { records: ProgressHubView['records']; vo2max: ProgressHubView['vo2max'] }) {
  const h = t.profile.hub
  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="records-tile">
      <Link href="/records" className={cn('flex flex-col gap-3', LINK_CARD)}>
      <div className="flex items-center justify-between gap-2">
        <span className={TITLE}>{h.records}</span>
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </div>
      {records.length === 0 ? (
        <span className="text-sm text-muted-foreground">{h.noRecords}</span>
      ) : (
        <dl className="grid grid-cols-4 gap-1.5" data-testid="records">
          {records.map((r) => (
            <div key={r.key} className="flex min-w-0 flex-col gap-0.5" data-testid="record">
              <dt className="flex items-baseline gap-1 whitespace-nowrap text-[11.5px] text-muted-foreground">
                {h.recordLabels[r.key] ?? r.label}
                {r.recent && (
                  <span data-testid="latest-record" aria-label={h.newRecordLabel} className="text-caption font-bold text-accent-text">
                    {h.newRecord}
                  </span>
                )}
              </dt>
              <dd className="whitespace-nowrap text-base font-semibold tabular-nums leading-tight text-foreground">{formatDuration(r.seconds)}</dd>
            </div>
          ))}
        </dl>
      )}
      </Link>
      {vo2max && (
        <Link
          href="/athlete"
          className={cn('flex items-center justify-between gap-3 border-t border-border pt-2.5 text-[13px]', LINK_CARD)}
          data-testid="vo2-row"
        >
          <span className="min-w-0 text-[var(--text-2)] text-pretty">
            {h.vo2max}{' '}
            <b className="font-semibold tabular-nums text-foreground">{formatDecimal(vo2max.value, 1)}</b>
            {vo2max.grade && ` · ${vo2max.grade.letter}`}
            {vo2max.grade?.topPercent != null && ` · ${t.vo2Grade.topPct(vo2max.grade.topPercent)}`}
          </span>
          {vo2max.delta !== null && (
            <span className="flex shrink-0 items-center gap-1 tabular-nums" data-testid="vo2-delta" style={{ color: deltaColor('vo2max', vo2max.delta) }}>
              {vo2max.delta !== 0 && (vo2max.delta > 0 ? <ArrowUpRight size={12} strokeWidth={2} aria-hidden /> : <ArrowDownRight size={12} strokeWidth={2} aria-hidden />)}
              {h.vo2Delta(formatDecimal(Math.abs(vo2max.delta), Number.isInteger(vo2max.delta) ? 0 : 1))}
            </span>
          )}
        </Link>
      )}
    </section>
  )
}

/** Slots: `explored` is a client island, `checkpoint` comes from a use case of its own. */
export function ProgressHub({ view, explored, checkpoint }: { view: ProgressHubView; explored?: ReactNode; checkpoint?: ReactNode }) {
  const h = t.profile.hub
  const { vo2max, consistency, shoes, allTime } = view
  const bestYearKm = Math.max(1, ...allTime.years.slice(-2).map((y) => y.km))

  return (
    <div className="flex flex-col gap-3.5">
      <header className="mb-1.5 flex items-start justify-between gap-3">
        <h1 className="min-w-0 text-display text-foreground">{t.nav.items.profile}</h1>
        <Link
          href="/settings"
          aria-label={h.settings}
          data-testid="settings-gear"
          // The compact bar reads this to keep the gear at the top right once the page scrolls.
          data-bar-action="settings"
          className={glassClass('regular', cn(GLASS_CIRCLE, 'lg:hidden'))}
        >
          <GlassLayers />
          <Settings size={20} strokeWidth={2} aria-hidden="true" />
        </Link>
      </header>

      {!view.race && view.block ? <BlockCard block={view.block} /> : <RaceCard race={view.race} />}
      <YearCard view={view} />
      {checkpoint}

      {/* Side by side, the two cards share a height: the streak strip grows into whatever Explored adds. */}
      <div className="flex flex-col gap-3.5 sm:grid sm:grid-cols-2" data-testid="progress-columns">
        <Tile href="/consistency" title={h.consistency} testId="consistency-tile">
          <div className="flex items-end justify-between gap-3">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-1">
              <span className="text-2xl font-bold leading-tight tabular-nums text-foreground" data-testid="streak-weeks">
                {consistency.streakWeeks}
              </span>
              <span className="text-[13px] text-muted-foreground text-pretty">{h.streakOf(consistency.thisWeek.target)}</span>
            </p>
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground" data-testid="consistency-this-week">
              {h.runsThisWeek(consistency.thisWeek.runs, consistency.thisWeek.target)}
            </span>
          </div>
          <div className="flex h-[30px] items-end gap-[3px] sm:h-auto sm:min-h-[30px] sm:flex-1" aria-hidden="true" data-testid="streak-strip">
            {consistency.strip.map((week) => (
              <span
                key={week.monday}
                data-hit={week.hit ? '' : undefined}
                data-current={week.current ? '' : undefined}
                className="box-border flex-1 rounded-[2px]"
                style={{
                  height: `${week.heightPct}%`,
                  ...(week.current
                    ? { border: '1px dashed var(--accent)' }
                    : { background: week.hit ? 'var(--accent)' : 'var(--neutral-bar)' }),
                }}
              />
            ))}
          </div>
        </Tile>
        {explored}
      </div>

      <Records records={view.records} vo2max={vo2max} />

      <Tile href="/athlete" title={h.athleteZones} testId="athlete-row">
        <span className="text-[13px] text-muted-foreground">{h.athleteZonesDetail}</span>
      </Tile>

      {shoes.length > 0 && (
        <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="shoes-tile">
          <div className="flex items-center justify-between gap-2">
            <h2 className={TITLE}>{h.shoes}</h2>
            <Link href="/shoes" className="hit-44 inline-flex items-center gap-0.5 text-footnote font-medium text-accent-text transition-opacity hover:opacity-80 active:opacity-60" data-testid="shoes-all">
              {h.allPairs}
              <ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
            </Link>
          </div>
          {shoes.map((s) => (
            <Link key={s.gearId} href={`/shoes/${s.gearId}`} className="flex flex-col gap-2 transition-opacity active:opacity-70" data-testid="shoe-row">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 break-words text-foreground text-pretty">
                  {s.name}
                  {s.status !== 'ok' && (
                    <span style={{ color: shoeColor(s.status) }} data-testid="shoe-status"> · {t.shoes.status[s.status].toLocaleLowerCase(t.locale)}</span>
                  )}
                </span>
                <span className="shrink-0 whitespace-nowrap text-[var(--text-2)]">
                  <b className="font-semibold text-foreground">{formatKm(s.km)}</b> / {formatKm(s.maxKm)} {t.units.km}
                </span>
              </div>
              <Bar share={s.maxKm > 0 ? s.km / s.maxKm : 0} color={shoeColor(s.status)} thin />
            </Link>
          ))}
        </section>
      )}

      <section className={cardClass({ className: cn('relative', LINK_CARD) })} data-testid="all-time-card">
        <Link href="/all-time" aria-label={h.openYears} className="absolute inset-0 rounded-[24px]" data-testid="all-time" />
        <div className="pointer-events-none relative flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className={TITLE}>{h.allTime}</span>
            {allTime.since && <Caption>{h.since(formatDate(allTime.since, { precision: 'month', year: 'always' }))}</Caption>}
          </div>
          <StatGrid columns={3}>
            <Stat label={h.distance} value={formatKm(allTime.km)} unit={t.units.km} valueStyle={{ fontSize: 24 }} />
            <Stat label={h.runsLabel} value={allTime.runs} valueStyle={{ fontSize: 24 }} />
            <Stat label={h.time} value={formatKm(allTime.hours)} unit={h.hours} valueStyle={{ fontSize: 24 }} />
          </StatGrid>
          <ul className="flex flex-col gap-3 border-t border-border pt-3 text-[13px]" data-testid="year-rows">
            {[...allTime.years.slice(-2)].reverse().map((y) => {
              const current = y.year === view.year
              return (
                <li key={y.year} className="grid grid-cols-[44px_minmax(0,1fr)_150px] items-center gap-3" data-testid="year-row">
                  <span className={cn(current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{y.year}</span>
                  <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <span className="block h-full rounded-full" data-testid="year-bar" style={{ width: `${(y.km / bestYearKm) * 100}%`, background: current ? 'var(--accent)' : 'var(--series-2)' }} />
                  </span>
                  <span className="text-right text-muted-foreground">
                    <b className="font-semibold text-foreground">{formatKm(y.km)} {t.units.km}</b> · {t.common.runs(y.runs)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
