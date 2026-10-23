'use client'

import { useCallback, useEffect, useId, useRef, useState, type Ref } from 'react'
import { ArrowDownToLine, Check, ChevronRight, Minus, Plus, Share2, X } from 'lucide-react'
import { t } from '@/i18n'
import type { RoutePreferences } from '@/domain/explore/types'
import { formatClock, formatDecimal, formatDistance, formatDurationWords, formatNumber, formatPercent } from '@/lib/formatters'
import { saveFileWithFallback } from '@/lib/fileExport'
import { useDragToDismiss } from '@/lib/useDragToDismiss'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { GlassLayers, glassClass } from '@/components/ui/GlassSurface'
import { SHEET_CONTROL } from '@/components/ui/Sheet'
import { Toggle } from '@/components/ui/Toggle'
import type { RouteFailure } from './routeApi'
import { canStepDown, canStepUp, stepRouteKm, type RouteStats } from './routeGenerator'

/** For the camera to measure, as the quartier sheet's. */
export const ROUTE_PANEL_TEST_ID = 'route-generator'

export type RouteGeneratorStatus = 'generating' | 'ready' | 'error'

/** Failures a second try can fix; the others need a change (distance) or can't be fixed here. */
const RETRYABLE: ReadonlySet<RouteFailure> = new Set(['rateLimited', 'providerLimit', 'upstream', 'invalid'])

export function failureMessage(failure: RouteFailure): string {
  const errors = t.pages.map.explore.errors
  switch (failure) {
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
  prefs: RoutePreferences
  onPrefsChange: (prefs: RoutePreferences) => void
  status: RouteGeneratorStatus
  failure: RouteFailure | null
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
  prefs,
  onPrefsChange,
  status,
  failure,
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

  const options = [e.loop, ...(prefs.avoidBusyRoads ? [e.summary.avoidBusyRoads] : []), ...(prefs.newStreetsFirst ? [e.summary.newStreetsFirst] : [])].join(' · ')
  const onPlan = plan?.km != null && plan.km === distanceKm
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
      <div className="flex min-h-0 flex-1 flex-col px-[var(--sheet-pad)] pb-[var(--sheet-pad)] pt-1.5">
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

        <div className="-mx-[var(--sheet-pad)] mt-3.5 flex min-h-0 flex-col gap-3.5 overflow-y-auto px-[var(--sheet-pad)]" style={{ touchAction: 'pan-y' }}>
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
              </div>
            )}
          </div>

          {status === 'error' && failure ? (
            <p role="alert" data-testid="route-error" className="min-h-[46px] text-[15px] leading-5 text-foreground text-pretty">
              {failureMessage(failure)}
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

          {/* 1 : 1.4 shares of the room their labels leave, so a long French label takes what it needs first. */}
          <div className="flex gap-2.5">
            {status === 'error' && failure && RETRYABLE.has(failure) ? (
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

          <p aria-live="polite" className="text-center text-footnote leading-[18px] text-muted-foreground">
            {status === 'generating' ? e.generating : e.footnote}
          </p>
        </div>
      </div>
    </div>
  )
}
