'use client'

import Link from 'next/link'
import { Check, ChevronRight, MapPin } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { setDaySkipped, useSkippedDays } from '@/lib/skippedDays'
import { useOwnerAuth } from '@/lib/useOwnerAuth'
import { SKIP_REASONS, type SkipReason } from '@/domain/wellness/checkIn'
import { Toast, useToast } from '@/components/ui/Toast'
import type { PlanRun } from './planRun'
import { sessionZone } from '@/lib/colors'
import { sessionHrCapBpm } from '@/domain/training/hrTarget'
import type { PlanFit } from '@/domain/training/planFit'
import { sessionLabel } from '@/lib/activityTitle'
import { formatClock, formatDurationWords, formatPace, formatPercent, formatPlannedKm, formatRanKm, formatWeekday } from '@/lib/formatters'
import { t } from '@/i18n'
import { ButtonLink } from '@/components/ui/Button'
import { exploreRouteHref, planRouteKm } from '@/components/explore/exploreHref'
import { planPaceSecPerKm } from './planPace'
import type { PlanWorkoutView } from './planWorkoutView'
import { kindLabel, type DayKind } from './sessionKind'
import { intensityBlocks, stepRows, type StepTone } from './workoutSteps'
import { paceLabel, workoutSummary } from './workoutSummary'

const CARD = 'content-card rounded-[24px] bg-card shadow-[var(--card-edge)] p-4'

const PROFILE_HEIGHT: Record<StepTone, number> = { ease: 14, recovery: 14, work: 44 }

function Eyebrow({ date, kind }: { date: string; kind: DayKind | null }) {
  return (
    <p
      className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]"
      style={{ color: kind?.text ?? 'var(--muted-foreground)' }}
    >
      <span>{[formatWeekday(date, true), kind ? kindLabel(kind.type, kind.kind) : null].filter(Boolean).join(' · ')}</span>
    </p>
  )
}

function Title({ children }: { children: ReactNode }) {
  return <h2 className="mt-1.5 break-words text-[25px] font-bold leading-tight tracking-[-0.01em] text-foreground text-pretty">{children}</h2>
}

function TargetTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px] rounded-[14px] bg-[var(--background)] px-3 py-2.5" data-testid="plan-target">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

/**
 * A one-step session shows its targets instead of a profile: one full-width
 * block would call an easy run structured.
 */
export function PlannedWorkoutCard({
  workout,
  kind,
  hrZoneBoundsBpm = null,
  exploreAvailable = false,
}: {
  workout: PlanWorkoutView
  kind: DayKind
  hrZoneBoundsBpm?: readonly number[] | null
  exploreAvailable?: boolean
}) {
  const s = t.plan.session
  const summary = workoutSummary(workout)
  const title = sessionLabel(summary.title)
  const totalSeconds = summary.durationSeconds ?? 0
  const structured = (workout.structure?.length ?? 0) > 1
  const km = summary.distanceM ? `${formatPlannedKm(summary.distanceM / 1000)} ${t.units.km}` : null
  const time = totalSeconds > 0 ? formatDurationWords(totalSeconds) : null
  const subline = [km, time, ...(structured ? summary.paces.map(paceLabel) : [])].filter(Boolean).join(' · ')
  const blocks = intensityBlocks(workout.structure, totalSeconds, kind.color)
  const rows = stepRows({ steps: workout.structure, type: kind.type, kind: kind.kind, color: kind.color, totalSeconds, pace: effortPace(workout.effort) })
  // A one-step session's steps collapse to none, so its pace comes from the
  // effort line.
  const paceTarget = structured
    ? null
    : (summary.paces[0] ? `${formatClock(summary.paces[0].pace[0])}–${formatClock(summary.paces[0].pace[1])}` : effortPaceRange(workout.effort))
  const hrCap = sessionHrCapBpm(workout.hr, hrZoneBoundsBpm)
  const hrZone = workout.hr?.zone ?? null
  const routeHref = exploreAvailable && kind.type !== 'Race' ? findRouteHref(workout) : null

  return (
    <section data-testid={`plan-workout-${workout.key}`} className={CARD}>
      <Eyebrow date={workout.date} kind={kind} />
      {structured ? (
        <>
          <Title>{title}</Title>
          {subline && <p className="mt-1 text-[13px] text-muted-foreground">{subline}</p>}
        </>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h2 className="break-words text-2xl font-bold leading-tight tracking-[-0.02em] text-foreground text-pretty">{title}</h2>
          {(km || time) && (
            <span className="text-sm text-[var(--text-2)]" data-testid="plan-amount">
              {km && <b className="font-semibold text-foreground">{km}</b>}
              {km && time && ' · '}
              {time}
            </span>
          )}
        </div>
      )}
      {structured && (
        <div aria-hidden data-testid="intensity-profile" className="mt-2.5 flex h-[44px] items-end gap-[3px]">
          {blocks.map((block, i) => (
            <span
              key={i}
              data-tone={block.tone}
              className="min-w-[3px] rounded-[4px]"
              style={{ flexGrow: block.seconds, flexBasis: 0, height: PROFILE_HEIGHT[block.tone], background: block.fill }}
            />
          ))}
        </div>
      )}
      {!structured && (paceTarget !== null || hrCap !== null) && (
        <div className="mt-2.5 grid grid-cols-2 gap-2" data-testid="plan-targets">
          {paceTarget !== null && <TargetTile label={s.paceTarget} value={`${paceTarget} ${t.units.perKm}`} />}
          {hrCap !== null && <TargetTile label={hrZone ? s.hrTargetZone(hrZone) : s.hrTarget} value={`${s.hrCap(hrCap)} ${t.units.bpm}`} />}
        </div>
      )}
      {structured && (
      <ol className="mt-3.5 border-t border-border" data-testid="workout-steps">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3 border-b border-border py-[7px] last:border-b-0">
            <span aria-hidden className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: row.fill }} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold text-foreground">{row.title}</span>
              {row.detail && <span className="text-[12.5px] text-muted-foreground">{row.detail}</span>}
            </span>
            <span className="shrink-0 text-[13px] tabular-nums text-[var(--text-2)]">{row.duration}</span>
          </li>
        ))}
      </ol>
      )}
      {routeHref && (
        // Not prefetched: Activities carries every run.
        <ButtonLink
          href={routeHref}
          prefetch={false}
          variant="secondary"
          size="lg"
          className="mt-3.5 w-full gap-2 text-accent-text"
          data-testid="find-route"
        >
          <MapPin size={18} strokeWidth={2.2} aria-hidden="true" />
          {s.findRoute}
        </ButtonLink>
      )}
    </section>
  )
}

/** With its day, so the generator names this session, not today's. */
function findRouteHref(workout: PlanWorkoutView): string | null {
  const km = planRouteKm(workout.distanceM)
  if (km === null) return null
  return exploreRouteHref({ km, paceSecPerKm: planPaceSecPerKm(workout), date: workout.date, from: 'plan' })
}

export function NextKeySessionCard({ weekday, title, color, onSelect }: { weekday: string; title: string; color: string; onSelect?: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-3 content-card rounded-[24px] bg-card shadow-[var(--card-edge)] px-4 py-3 text-left transition-transform duration-100 ease-out active:scale-[0.98]"
      data-testid="next-key-session"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color }}>{t.plan.nextKeySession}</span>
        <span className="truncate text-sm font-semibold text-foreground">{`${weekday} · ${title}`}</span>
      </span>
      <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
    </button>
  )
}

// An effort line reads "Z2 easy · 5:10-6:27 /km".
const EFFORT_PACE = /(\d{1,2}:\d{2})[-–](\d{1,2}:\d{2})\s*\/km$/

function effortPace(effort: string | null): string | null {
  const range = effortPaceRange(effort)
  return range ? t.plan.row.pace(range) : null
}

function effortPaceRange(effort: string | null): string | null {
  const match = effort?.match(EFFORT_PACE)
  return match ? `${match[1]}–${match[2]}` : null
}

function Line({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-2 py-1.5 text-sm" data-testid={testId}>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground">{children}</span>
    </div>
  )
}

/** A skipped day is drawn as rest on Today, Plan and the month, and stops counting as missed. */
function MissedLine({ date }: { date: string }) {
  const skipped = useSkippedDays().get(date) ?? null
  const { isOwner } = useOwnerAuth()
  const [choosing, setChoosing] = useState(false)
  const { toast, leaving, showToast } = useToast()
  const s = t.plan.dayCard
  const mark = (reason: SkipReason | null) => {
    setChoosing(false)
    setDaySkipped(date, reason).catch(() => showToast(t.settings.actions.error, false))
  }
  const action = 'ml-2 text-[13px] font-medium text-accent-text'
  return (
    <Line label={t.plan.dayCard.done} testId="done-line">
      {skipped ? (
        <span className="font-semibold text-muted-foreground" data-testid="skipped-mark">{s.skippedFor(s.skipReasons[skipped])}</span>
      ) : (
        <span className="font-semibold text-[var(--warn)]">{t.sessionState.missed}</span>
      )}
      {isOwner && (skipped ? (
        <button type="button" onClick={() => mark(null)} className={action} data-testid="skip-toggle">{s.undoSkip}</button>
      ) : choosing ? (
        SKIP_REASONS.map((reason) => (
          <button key={reason} type="button" onClick={() => mark(reason)} className={action} data-testid={`skip-${reason}`}>
            {s.skipReasons[reason]}
          </button>
        ))
      ) : (
        <button type="button" onClick={() => setChoosing(true)} className={action} data-testid="skip-toggle">{s.markSkipped}</button>
      ))}
      <Toast toast={toast} leaving={leaving} />
    </Line>
  )
}

function FitMark({ fit }: { fit: PlanFit }) {
  if (fit === 'asPlanned') {
    return (
      <Check
        size={13}
        strokeWidth={3}
        role="img"
        aria-label={t.plan.dayCard.asPlanned}
        className="ml-1.5 inline-block shrink-0 align-[-2px] text-[var(--pos)]"
        data-testid="plan-fit"
        data-fit={fit}
      />
    )
  }
  return (
    <span className="ml-1.5 text-[13px] font-medium text-[var(--tone-caution)]" data-testid="plan-fit" data-fit={fit}>
      {t.plan.dayCard.fit[fit]}
    </span>
  )
}

export function DoneDayCard({
  date,
  kind,
  title,
  planned,
  acts,
  fit,
  ranOn = null,
}: {
  date: string
  kind: DayKind | null
  title: string
  /** "10 km · Easy run". */
  planned: string | null
  acts: PlanRun[]
  /** The day's runs against its session; null when nothing was planned. */
  fit: PlanFit | null
  /** The day the session was run instead, a day either side. */
  ranOn?: string | null
}) {
  const zone = sessionZone({ type: kind?.type })
  return (
    <section data-testid={`plan-day-done-${date}`} className={CARD}>
      <Eyebrow date={date} kind={kind} />
      <Title>{title}</Title>
      <div className="mt-3 border-t border-border pt-1.5">
        <Line label={t.plan.dayCard.planned} testId="planned-line">
          {planned ?? <span className="text-muted-foreground">{t.plan.dayCard.notPlanned}</span>}
        </Line>
        {acts.length === 0 && ranOn ? (
          <Line label={t.plan.dayCard.done} testId="done-line">
            <span className="font-semibold text-[var(--pos)]">{t.plan.dayCard.ranOn(formatWeekday(ranOn, true))}</span>
          </Line>
        ) : acts.length === 0 ? (
          <MissedLine date={date} />
        ) : (
          acts.map((a, i) => {
            const share = a.zonePercents[zone - 1] ?? undefined
            return (
              <Line key={a.id} label={t.plan.dayCard.done} testId="done-line">
                <span className="font-semibold">{`${formatRanKm(a.distanceKm)} ${t.units.km}`}</span>
                {[
                  a.paceSecPerKm !== null ? formatPace(a.paceSecPerKm) : null,
                  share !== undefined ? `${t.trainingZones.zoneNumber(zone)} ${formatPercent(share)}` : null,
                ]
                  .filter(Boolean)
                  .map((part) => ` · ${part}`)
                  .join('')}
                {fit && i === acts.length - 1 && <FitMark fit={fit} />}
              </Line>
            )
          })
        )}
      </div>
      {acts.map((a) => (
        <Link
          key={a.id}
          href={`/activities/${a.id}`}
          className="mt-2 flex items-center justify-between gap-2 rounded-[14px] bg-[var(--surface-2)] px-3.5 py-3 text-sm font-semibold text-accent-text transition-colors hover:bg-[var(--line-2)]"
        >
          <span className="min-w-0 truncate">{acts.length > 1 ? t.plan.dayCard.viewNamed(a.description || t.activityTypes[a.type]) : t.plan.dayCard.viewActivity}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ))}
    </section>
  )
}

export function RestDayCard({ date, next, covered = true }: { date: string; next: { weekday: string; title: string } | null; covered?: boolean }) {
  const r = t.plan.restCard
  return (
    <section
      data-testid="plan-rest-day"
      data-covered={String(covered)}
      className="flex items-center justify-between gap-3 rounded-[18px] border border-dashed border-border px-4 py-3"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{`${formatWeekday(date, true)} · ${r.eyebrow}`}</p>
        <h2 className="text-[17px] font-semibold leading-tight text-foreground">{covered ? r.title : t.plan.dayCard.notPlanned}</h2>
      </div>
      {next && (
        <p className="flex min-w-0 flex-col items-end text-right text-xs text-muted-foreground" data-testid="rest-next">
          <span className="whitespace-nowrap">{r.next(next.weekday)}</span>
          <span className="max-w-full truncate">{next.title}</span>
        </p>
      )}
    </section>
  )
}

export function BlockFinishedCard({ done, total }: { done: number; total: number }) {
  const r = t.plan.restCard
  return (
    <section
      data-testid="plan-block-finished"
      className="flex flex-col gap-0.5 rounded-[18px] border border-dashed border-border px-4 py-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{r.finishedEyebrow}</p>
      <h2 className="text-[17px] font-semibold leading-tight text-foreground">{r.finished(done, total)}</h2>
    </section>
  )
}

export interface ComingUpRow {
  key: string
  date: string
  title: string
  /** "Tue 20 · 10 km · 1:00 h". */
  detail: string
  color: string
}

export function ComingUpCard({ rows, selectedDate, onSelect }: { rows: ComingUpRow[]; selectedDate: string; onSelect: (date: string) => void }) {
  const c = t.plan.comingUp
  return (
    <section className="content-card rounded-[24px] bg-card shadow-[var(--card-edge)] px-4 pb-1 pt-3.5" data-testid="coming-up">
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <h2 className="text-headline text-foreground">{c.title}</h2>
        <span className="text-xs text-muted-foreground">{c.hint}</span>
      </div>
      <ul>
        {rows.map((row) => (
          <li key={row.key} className="border-t border-border">
            <button
              type="button"
              onClick={() => onSelect(row.date)}
              aria-pressed={row.date === selectedDate}
              className="flex w-full items-center gap-3 py-3 text-left transition-opacity active:opacity-70"
              data-testid="coming-up-row"
            >
              <span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ background: row.color }} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold text-foreground">{row.title}</span>
                <span className="text-xs text-muted-foreground">{row.detail}</span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
