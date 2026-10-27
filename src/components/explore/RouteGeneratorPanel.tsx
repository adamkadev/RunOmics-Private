'use client'

import { useCallback, useEffect, useId, useRef, useState, type Ref } from 'react'
import { ArrowDownToLine, Check, ChevronRight, Minus, Plus, Share2, X } from 'lucide-react'
import { t } from '@/i18n'
import { AVOID_LIMITS, AVOID_RADII_M, AVOID_REASONS, type AvoidReason } from '@/domain/explore/avoidSpots'
import { climbBudget, type ClimbBudget, type SessionDay } from '@/domain/explore/climbBudget'
import type { Darkness } from '@/domain/explore/daylight'
import type { RoutePreferences } from '@/domain/explore/types'
import {
  formatClock,
  formatDate,
  formatDecimal,
  formatDistance,
  formatDurationWords,
  formatNumber,
  formatPercent,
  formatTimeOfDay,
} from '@/lib/formatters'
import { saveFileWithFallback } from '@/lib/fileExport'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { GlassLayers, glassClass } from '@/components/ui/GlassSurface'
import { SEGMENTED_FILL_SEGMENT_CLASS, SEGMENTED_IDLE_CLASS, SEGMENTED_THUMB_CLASS, SEGMENTED_TRACK_CLASS } from '@/components/ui/SegmentedTabs'
import { SHEET_CONTROL } from '@/components/ui/Sheet'
import { Toggle } from '@/components/ui/Toggle'
import { ROUTE_KM_MAX } from './exploreHref'
import { canStepDown, canStepUp, stepRouteKm, type RouteStats } from './routeGenerator'
import { ROUTE_START_MODES, type RouteStartMode } from './routeStart'
import type { AvoidSpots } from './useAvoidSpots'
import type { GeneratorFailure } from './useRouteGenerator'

/** For the camera to measure, as the quartier sheet's. */
export const ROUTE_PANEL_TEST_ID = 'route-generator'

export type RouteGeneratorStatus = 'generating' | 'ready' | 'error'

/** Failures a second try can fix; the others need a change (distance) or can't be fixed here. */
const RETRYABLE: ReadonlySet<GeneratorFailure> = new Set<GeneratorFailure>(['rateLimited', 'providerLimit', 'upstream', 'invalid', 'tracks'])

export function failureMessage(failure: GeneratorFailure): string {
  const errors = t.pages.map.explore.errors
  switch (failure) {
    case 'tooFar':
      return errors.tooFarToRun
    case 'tracks':
      return errors.tracks
    case 'notConfigured':
      return errors.notConfigured
    case 'auth':
      return errors.auth
    case 'rateLimited':
    case 'providerLimit':
      return errors.rateLimited
    case 'dailyQuota':
      return errors.dailyQuota
    case 'noRoute':
      return errors.noRoute
    case 'invalid':
    case 'upstream':
      return errors.upstream
  }
}

/** Under a tenth of the loop on trails is a footpath through a park, not a trail run. */
const NOTABLE_TRAIL_PCT = 10
/** About two minutes of walking at 10 % or more: enough to break an easy run's heart rate. */
const STEEP_HINT_M = 200

export function climbLine(budget: ClimbBudget, stats: Pick<RouteStats, 'climbPerKm'> | null): string {
  const c = t.pages.map.explore.climb
  const session = c.sessions[budget.kind]
  const perKm = stats?.climbPerKm != null ? formatNumber(stats.climbPerKm, 0) : null
  if (budget.maxMPerKm === null) return perKm === null ? c.flat(session) : c.flatLoop(session, perKm)
  const max = formatNumber(budget.maxMPerKm, 0)
  if (perKm === null) return c.upTo(session, max)
  return stats!.climbPerKm! > budget.maxMPerKm ? c.over(session, perKm, max) : c.within(session, perKm, max)
}

export function darknessLine(darkness: Darkness): string | null {
  const d = t.pages.map.explore.dark
  if (!darkness) return null
  if (darkness.kind === 'night') return d.night
  return darkness.kind === 'dusk' ? d.dusk(formatTimeOfDay(darkness.at)) : d.dawn(formatTimeOfDay(darkness.at))
}

export function terrainLine(budget: ClimbBudget, stats: Pick<RouteStats, 'trailPct' | 'steepClimbM'> | null): string | null {
  const e = t.pages.map.explore
  if (!stats) return null
  const easyDay = budget.kind !== 'quality' && budget.kind !== 'beforeQuality'
  const parts = [
    ...(stats.trailPct >= NOTABLE_TRAIL_PCT ? [e.trailShare(formatPercent(stats.trailPct))] : []),
    ...(easyDay && stats.steepClimbM >= STEEP_HINT_M ? [e.steepHint] : []),
  ]
  return parts.length > 0 ? parts.join(' · ') : null
}

const km = (value: number) => `${formatDistance(value)} ${t.units.km}`

const stepperKm = (value: number) => `${formatDecimal(value, 1)} ${t.units.km}`

/** A grouped fill: no glass inside glass. */
const GROUPED = 'rounded-[20px] bg-[var(--sheet-fill)] shadow-[var(--sheet-fill-rim)]'
/** A label that can't fit is cut short, not wrapped, and a size down on a 320 pt phone, so the row holds in both languages. */
const ROW_BUTTON = 'min-w-0 whitespace-nowrap px-3 max-[359px]:text-[14px]'
/** 38 pt, a 44 pt hit. */
const STEP_BUTTON = cn(SHEET_CONTROL, 'size-[38px] h-[38px] text-foreground disabled:opacity-35')

export interface RouteGeneratorPanelProps {
  unitName: string | null
  /** On the stepper's 0.5 km grid. */
  distanceKm: number
  onDistanceChange: (km: number) => void
  /** The session it plans for; its km is what the check compares the distance with. */
  plan: { heading: string; label: string; km: number | null } | null
  start: { mode: RouteStartMode; waiting: boolean }
  onStartModeChange: (mode: RouteStartMode) => void
  day: SessionDay
  darkness: Darkness
  avoid: AvoidSpots
  prefs: RoutePreferences
  onPrefsChange: (prefs: RoutePreferences) => void
  status: RouteGeneratorStatus
  failure: GeneratorFailure | null
  /** With `tooFar`: the shortest distance that reaches the quartier. */
  minKm: number | null
  stats: RouteStats | null
  /** The pace the time is worked out at. */
  paceSecPerKm: number | null
  /** Changes with every loop shown: a save is for one loop. */
  routeKey: string | null
  gpxFile: () => File | null
  onRegenerate: () => void
  onRetry: () => void
  onClose: () => void
  ref?: Ref<HTMLDivElement>
}

/** Not modal: no scrim and nothing made inert, so the map above it still pans and zooms. */
export function RouteGeneratorPanel({
  unitName,
  distanceKm,
  onDistanceChange,
  plan,
  start,
  onStartModeChange,
  day,
  darkness,
  avoid,
  prefs,
  onPrefsChange,
  status,
  failure,
  minKm,
  stats,
  paceSecPerKm,
  routeKey,
  gpxFile,
  onRegenerate,
  onRetry,
  onClose,
  ref,
}: RouteGeneratorPanelProps) {
  const e = t.pages.map.explore
  const titleId = useId()
  const optionsId = useId()
  const { close, handleProps, sheetStyle } = useDragToDismiss(onClose)
  // Focus comes into the dialog on open, since the control that opened it is usually gone; on close the map gives it back (GlobalMapClient).
  const dialogRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
  }, [])
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      dialogRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )
  const [optionsOpen, setOptionsOpen] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const markRef = useRef<HTMLButtonElement | null>(null)
  const wasMarking = useRef(avoid.marking)
  // Back from the marking bar, its row is scrolled to the top so the new spot's row, and its reason, are in view.
  useEffect(() => {
    const back = wasMarking.current && !avoid.marking
    wasMarking.current = avoid.marking
    const list = listRef.current
    const mark = markRef.current
    if (!back || !list || !mark) return
    list.scrollTop += mark.getBoundingClientRect().top - list.getBoundingClientRect().top
    mark.focus({ preventScroll: true })
  }, [avoid.marking])
  // The file saved, and for which loop: a new loop is a new file to save.
  const [saved, setSaved] = useState<{ key: string; file: File; canShare: boolean } | null>(null)
  const isSaved = saved !== null && saved.key === routeKey
  const ready = status === 'ready' && stats !== null

  const download = async () => {
    const file = gpxFile()
    if (!file || !routeKey) return
    const outcome = await saveFileWithFallback(file)
    if (outcome === 'cancelled') return
    const canShare = typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] })
    setSaved({ key: routeKey, file, canShare })
  }
  const share = async () => {
    if (!saved) return
    try {
      await navigator.share({ files: [saved.file], title: saved.file.name })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error(err)
    }
  }

  const options = [
    e.loop,
    ...(prefs.avoidBusyRoads ? [e.summary.avoidBusyRoads] : []),
    ...(prefs.newStreetsFirst ? [e.summary.newStreetsFirst] : []),
    ...(prefs.flatForReps ? [e.summary.flatForReps] : []),
  ].join(' · ')
  const budget = climbBudget(day)
  const notes = [climbLine(budget, ready ? stats : null), darknessLine(darkness), terrainLine(budget, ready ? stats : null)].filter(
    (line): line is string => line !== null,
  )
  const onPlan = plan?.km != null && plan.km === distanceKm
  const reachKm = failure === 'tooFar' && minKm != null && minKm <= ROUTE_KM_MAX ? minKm : null
  const errorText = reachKm != null ? e.errors.tooFar(stepperKm(reachKm)) : failure ? failureMessage(failure) : null
  const footnote = start.waiting ? e.start.pickPrompt : status === 'generating' ? e.generating : e.footnote
  const dash = '—'
  const statCells = [
    { label: e.distanceStat, value: ready ? km(stats.distanceKm) : dash },
    {
      label: paceSecPerKm != null ? e.atPace(formatClock(paceSecPerKm)) : e.timeStat,
      value: ready && stats.timeSeconds != null ? formatDurationWords(stats.timeSeconds) : dash,
    },
    { label: e.climbStat, value: ready && stats.climbM != null ? `+${formatNumber(stats.climbM, 0)} ${t.units.m}` : dash },
    { label: e.newStat, value: ready ? formatPercent(stats.newPct) : dash, accent: true },
  ]

  return (
    <div
      ref={setRefs}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-testid={ROUTE_PANEL_TEST_ID}
      className={glassClass(
        'sheet',
        'pointer-events-auto flex max-h-[calc(100dvh-var(--safe-top)-120px)] w-full flex-col rounded-[var(--radius-sheet)] outline-none animate-[sheet-rise_520ms_cubic-bezier(0.22,1,0.36,1)_both]',
      )}
      style={sheetStyle}
    >
      <GlassLayers />
      {avoid.marking && <MarkingBar onCancel={() => avoid.setMarking(false)} />}
      <div hidden={avoid.marking} className="flex min-h-0 flex-1 flex-col px-[var(--sheet-pad)] pb-[var(--sheet-pad)] pt-1.5">
        <div className="-mx-[var(--sheet-pad)] flex justify-center pb-2.5" {...handleProps}>
          <span aria-hidden="true" className="h-[5px] w-9 rounded-[2.5px] bg-[rgb(127_127_127/0.45)]" />
        </div>

        <div className="grid h-11 shrink-0 grid-cols-[44px_1fr_44px] items-center gap-2">
          <button type="button" onClick={close} aria-label={t.common.close} className={cn(SHEET_CONTROL, 'w-11 text-foreground')}>
            <X size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
          <h2 id={titleId} className="min-w-0 truncate text-center text-headline text-foreground">
            {unitName ? e.title(unitName) : ' '}
          </h2>
          <span aria-hidden="true" />
        </div>

        <div ref={listRef} className="-mx-[var(--sheet-pad)] mt-3.5 flex min-h-0 flex-col gap-3.5 overflow-y-auto px-[var(--sheet-pad)]" style={{ touchAction: 'pan-y' }}>
          {plan && (
            <button
              type="button"
              data-testid="route-plan"
              onClick={() => plan.km != null && onDistanceChange(plan.km)}
              aria-pressed={onPlan}
              aria-label={plan.km != null ? `${plan.heading}: ${plan.label}. ${e.usePlanDistance(stepperKm(plan.km))}` : undefined}
              className={cn(GROUPED, 'flex min-h-[64px] items-center gap-3 py-3 pl-4 pr-3.5 text-left')}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[11px] font-semibold uppercase leading-[14px] tracking-[0.1em] text-accent-text">{plan.heading}</span>
                <span className="truncate text-[16px] font-semibold leading-[22px] text-foreground">{plan.label}</span>
              </span>
              {onPlan && (
                <span data-testid="route-plan-check" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </button>
          )}

          <div role="group" aria-label={e.start.label} data-testid="route-start" className={cn(SEGMENTED_TRACK_CLASS, 'w-full')}>
            {ROUTE_START_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onStartModeChange(mode)}
                aria-pressed={start.mode === mode}
                aria-label={e.start.modesFull[mode]}
                className={cn(
                  SEGMENTED_FILL_SEGMENT_CLASS,
                  'hit-44 flex h-8 items-center whitespace-nowrap px-2 text-[13px] transition-colors',
                  start.mode === mode ? SEGMENTED_THUMB_CLASS : SEGMENTED_IDLE_CLASS,
                )}
              >
                <span className="truncate">{e.start.modes[mode]}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[17px] leading-[22px] text-foreground">{e.distance}</span>
            <div role="group" aria-label={e.distance} className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => onDistanceChange(stepRouteKm(distanceKm, -1))}
                disabled={!canStepDown(distanceKm)}
                aria-label={e.shorter}
                className={STEP_BUTTON}
              >
                <Minus size={16} strokeWidth={2.4} aria-hidden="true" />
              </button>
              {/* As wide as "30.0 km", so the − circle stays put past 10 km. */}
              <span
                data-testid="route-distance"
                aria-live="polite"
                className="min-w-[84px] text-center text-[22px] font-bold leading-7 tracking-[-0.01em] tabular-nums text-foreground max-[359px]:min-w-[72px]"
              >
                {stepperKm(distanceKm)}
              </span>
              <button
                type="button"
                onClick={() => onDistanceChange(stepRouteKm(distanceKm, 1))}
                disabled={!canStepUp(distanceKm)}
                aria-label={e.longer}
                className={STEP_BUTTON}
              >
                <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setOptionsOpen((open) => !open)}
              aria-expanded={optionsOpen}
              aria-controls={optionsId}
              aria-label={`${e.options}: ${options}`}
              className={cn(GROUPED, 'flex h-[46px] items-center gap-2 pl-4 pr-3.5 text-left')}
            >
              {/* 14 pt, so the three options fit a 393 pt phone's row. */}
              <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{options}</span>
              <ChevronRight
                size={16}
                aria-hidden="true"
                className={cn('shrink-0 text-muted-foreground transition-transform duration-200', optionsOpen && 'rotate-90')}
              />
            </button>
            {optionsOpen && (
              <div id={optionsId} className={cn(GROUPED, 'flex flex-col')}>
                <label className="flex min-h-[50px] items-center justify-between gap-3 pl-4 pr-2.5">
                  <span className="text-[15px] text-foreground">{e.avoidBusyRoads}</span>
                  <Toggle checked={prefs.avoidBusyRoads} onChange={(on) => onPrefsChange({ ...prefs, avoidBusyRoads: on })} label={e.avoidBusyRoads} />
                </label>
                <div aria-hidden="true" className="ml-4 h-px bg-[var(--row-separator)]" />
                <label className="flex min-h-[50px] items-center justify-between gap-3 pl-4 pr-2.5">
                  <span className="text-[15px] text-foreground">{e.newStreetsFirst}</span>
                  <Toggle checked={prefs.newStreetsFirst} onChange={(on) => onPrefsChange({ ...prefs, newStreetsFirst: on })} label={e.newStreetsFirst} />
                </label>
                <div aria-hidden="true" className="ml-4 h-px bg-[var(--row-separator)]" />
                <label className="flex min-h-[50px] items-center justify-between gap-3 pl-4 pr-2.5">
                  <span className="text-[15px] text-foreground">{e.flatForReps}</span>
                  <Toggle checked={prefs.flatForReps} onChange={(on) => onPrefsChange({ ...prefs, flatForReps: on })} label={e.flatForReps} />
                </label>
                {avoid.enabled && <AvoidSpotsRows avoid={avoid} markRef={markRef} />}
              </div>
            )}
          </div>

          {status === 'error' && errorText ? (
            <p role="alert" data-testid="route-error" className="min-h-[46px] text-[15px] leading-5 text-foreground text-pretty">
              {errorText}
            </p>
          ) : (
            // Fixed shares sized for the widest each takes ("30.0 km", "+148 m", "100%"), so nothing shifts as loops come and go.
            <dl
              data-testid="route-stats"
              aria-busy={status === 'generating'}
              className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,0.85fr)] gap-2 max-[359px]:gap-1.5"
            >
              {statCells.map((cell) => (
                // The label first for a screen reader; CSS order draws the value over it.
                <div key={cell.label} className="flex min-w-0 flex-col">
                  <dt className="order-2 truncate text-[13px] leading-[18px] text-muted-foreground">{cell.label}</dt>
                  <dd
                    className={cn(
                      // 22 pt from a 393 pt phone, down to 17 pt on a 320 pt one, where four columns hold about 60 pt each.
                      'order-1 truncate text-[clamp(16px,calc(7.5vw_-_7px),22px)] font-bold leading-7 tracking-[-0.02em] tabular-nums',
                      cell.accent && ready ? 'text-accent-text' : 'text-foreground',
                    )}
                  >
                    {cell.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {notes.length > 0 && (
            <div data-testid="route-notes" className="-mt-1 flex flex-col gap-0.5 text-[13px] leading-[18px] text-muted-foreground">
              {notes.map((line) => (
                <p key={line} className="text-pretty">
                  {line}
                </p>
              ))}
            </div>
          )}

          {/* 1 : 1.4 shares of the room their labels leave, so a long French label takes what it needs first. */}
          <div className="flex gap-2.5">
            {status === 'error' && reachKm != null ? (
              <Button
                size="lg"
                variant="secondary"
                onClick={() => onDistanceChange(reachKm)}
                className={cn('flex-[1_1_auto] bg-[var(--sheet-fill)] shadow-[var(--sheet-fill-rim)]', ROW_BUTTON)}
              >
                <span className="truncate">{e.useDistance(stepperKm(reachKm))}</span>
              </Button>
            ) : status === 'error' && failure && RETRYABLE.has(failure) ? (
              <Button size="lg" variant="secondary" onClick={onRetry} className={cn('flex-[1_1_auto] bg-[var(--sheet-fill)] shadow-[var(--sheet-fill-rim)]', ROW_BUTTON)}>
                <span className="truncate">{e.retry}</span>
              </Button>
            ) : (
              <Button
                size="lg"
                variant="secondary"
                onClick={onRegenerate}
                disabled={status === 'generating' || (status === 'error' && failure !== 'noRoute')}
                className={cn('flex-[1_1_auto] bg-[var(--sheet-fill)] shadow-[var(--sheet-fill-rim)]', ROW_BUTTON)}
              >
                <span className="truncate">{e.regenerate}</span>
              </Button>
            )}
            {isSaved ? (
              <>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={download}
                  data-testid="route-saved"
                  // Gives way first on a narrow phone: Regenerate keeps its word whole.
                  className={cn('flex-[1_1_auto] gap-2 bg-[var(--sheet-fill)] shadow-[var(--sheet-fill-rim)]', ROW_BUTTON)}
                >
                  <Check size={20} strokeWidth={2.4} aria-hidden="true" className="shrink-0 text-accent-text" />
                  <span className="truncate">{e.saved}</span>
                </Button>
                {saved.canShare && (
                  <Button size="lg" onClick={share} aria-label={e.share} className="w-11 shrink-0 px-0">
                    <Share2 size={20} aria-hidden="true" />
                  </Button>
                )}
              </>
            ) : (
              <Button size="lg" onClick={download} disabled={!ready} className={cn('flex-[1.4_1_auto] gap-2', ROW_BUTTON)}>
                <ArrowDownToLine size={20} aria-hidden="true" className="shrink-0 max-[359px]:hidden" />
                <span className="truncate">{e.download}</span>
              </Button>
            )}
          </div>

          <p aria-live="polite" data-testid="route-footnote" className="text-center text-footnote leading-[18px] text-muted-foreground">
            {footnote}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Concentric with the sheet's corner, which a 74 pt bar rounds to 37 (12 + 25). */
function MarkingBar({ onCancel }: { onCancel: () => void }) {
  const a = t.pages.map.explore.avoid
  const promptId = useId()
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  // The button that opened the bar is hidden with the panel's rows.
  useEffect(() => {
    cancelRef.current?.focus({ preventScroll: true })
  }, [])
  return (
    <div data-testid="route-avoid-marking" className="flex min-h-[74px] items-center gap-3 py-3 pl-[var(--sheet-pad)] pr-3">
      <p id={promptId} className="min-w-0 flex-1 text-[15px] leading-5 text-foreground text-pretty max-[359px]:text-[14px]">
        {a.markPrompt}
      </p>
      <Button
        ref={cancelRef}
        size="lg"
        variant="secondary"
        onClick={onCancel}
        aria-describedby={promptId}
        className="shrink-0 bg-[var(--sheet-fill)] px-5 shadow-[var(--sheet-fill-rim)]"
      >
        {a.cancel}
      </Button>
    </div>
  )
}

function AvoidSpotsRows({ avoid, markRef }: { avoid: AvoidSpots; markRef: Ref<HTMLButtonElement> }) {
  const a = t.pages.map.explore.avoid
  const fullId = useId()
  const day = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })
  return (
    <>
      <div aria-hidden="true" className="ml-4 h-px bg-[var(--row-separator)]" />
      <div className="flex min-h-[50px] items-center justify-between gap-3 pl-4 pr-2.5">
        <span className="text-[15px] text-foreground">{a.title}</span>
        <Button
          ref={markRef}
          size="sm"
          variant="secondary"
          onClick={() => avoid.setMarking(true)}
          disabled={avoid.full}
          aria-describedby={avoid.full ? fullId : undefined}
          data-testid="route-avoid-mark"
        >
          {a.mark}
        </Button>
      </div>
      {avoid.full && (
        <p id={fullId} data-testid="route-avoid-full" className="px-4 pb-2.5 text-[13px] leading-[18px] text-muted-foreground">
          {a.full(AVOID_LIMITS.stored)}
        </p>
      )}
      {avoid.spots.map((spot) => {
        const selected = avoid.selectedId === spot.id
        return (
          <div key={spot.id} data-testid="route-avoid-spot" data-selected={selected || undefined} className="flex flex-col">
            <div className="flex min-h-[44px] items-center gap-2 pl-4 pr-1.5">
              <button
                type="button"
                onClick={() => avoid.locate(spot.id)}
                aria-label={a.locate(day(spot.createdAt))}
                className="min-h-[44px] min-w-0 flex-1 truncate text-left text-[13px] text-muted-foreground"
              >
                {spot.expiresOn ? a.markedUntil(day(spot.createdAt), day(spot.expiresOn)) : a.marked(day(spot.createdAt))}
              </button>
              <select
                aria-label={a.reason}
                value={spot.reason ?? ''}
                onChange={(event) => avoid.setReason(spot.id, (event.target.value || null) as AvoidReason | null)}
                className="h-8 rounded-lg bg-transparent text-[13px] text-foreground"
              >
                <option value="">{a.reasons.none}</option>
                {AVOID_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {a.reasons[reason]}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => avoid.remove(spot.id)} aria-label={a.remove} className="hit-44 flex size-8 items-center justify-center text-muted-foreground">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            {selected && (
              <div role="group" aria-label={a.radius} data-testid="route-avoid-radius" className="flex items-center gap-2 pb-2.5 pl-4 pr-2.5">
                {AVOID_RADII_M.map((radiusM) => (
                  <button
                    key={radiusM}
                    type="button"
                    aria-pressed={spot.radiusM === radiusM}
                    onClick={() => avoid.setRadius(spot.id, radiusM)}
                    className={cn(
                      'hit-44 h-8 rounded-full px-3 text-[13px] font-medium tabular-nums',
                      spot.radiusM === radiusM ? 'bg-accent text-accent-foreground' : 'bg-[var(--sheet-fill)] text-foreground shadow-[var(--sheet-fill-rim)]',
                    )}
                  >
                    {a.radiusM(formatNumber(radiusM, 0))}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {avoid.failed && (
        <p role="alert" className="px-4 pb-2.5 text-[13px] leading-[18px] text-foreground">
          {a.failed}
        </p>
      )}
    </>
  )
}
