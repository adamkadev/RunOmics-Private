'use client'

import { useState } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { formatClock, formatDate, formatDecimal, formatDelta, formatDeltaFixed } from '@/lib/formatters'
import { DELTA_TONE_COLOR } from '@/lib/deltaTone'
import { VerdictEyebrow } from '@/components/ui/Verdict'
import type { StatTone } from '@/components/ui/Stat'
import { t } from '@/i18n'
import { Dialog } from './AnalyticsKit'
import { loadCoachHeadline, loadTrendView, loadTrendYMax, recoveryView, type LoadCoachHeadline } from './loadRecoveryView'
import type { AnalyticsBoardData } from './AnalyticsClient'
import {
  coachRead,
  dayWindow,
  efficiencyView,
  formView,
  isSpeedSignal,
  paceShift,
  predictionRows,
  thresholdShift,
  weeksIn,
  type CoachReadView,
  type DayWindow,
  type SpeedKey,
  type Trend,
} from './analyticsView'

const bare = (iso: string) => formatDate(iso, { style: 'bare', year: 'never' })

/** The load headline's words (v5.4), first match of load and recovery. */
export function loadHeadlineText(h: LoadCoachHeadline): string {
  const s = t.analytics.cards.coachRead.load
  const span = t.analytics.cards.loadTrend.span
  switch (h.kind) {
    case 'spikeAndDip':
      return s.spikeAndDip
    case 'spike':
      return h.change ? s.spike(h.change.pct, span(h.change.days)) : s.spikeAbove
    case 'dip':
      return s.dip
    case 'building':
      return h.recovery ? s.building(h.change.pct, span(h.change.days)) : s.buildingLoad(h.change.pct, span(h.change.days))
  }
}

/** The speed reads a headline names, joined as the locale lists them. */
function named(keys: SpeedKey[]): { names: string; plural: boolean } {
  const words = keys.map((key) => t.analytics.cards.coachRead.names[key])
  return {
    names: new Intl.ListFormat(t.locale, { style: 'long', type: 'conjunction' }).format(words.map((w) => w.word)),
    plural: words.length > 1 || words.some((w) => w.plural),
  }
}

const capitalized = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * The headline the signals back (v4.16.4): it names only the reads that moved
 * the way it says. "Load is up, but threshold and race predictions haven't
 * followed" was one fixed sentence, printed whichever reads had slipped.
 */
function readHeadline(view: CoachReadView): string {
  const s = t.analytics.cards.coachRead.headline
  const speed = view.signals.filter(isSpeedSignal)
  const improved = named(speed.filter((sig) => sig.trend === 'improving').map((sig) => sig.key))
  const slipped = named(speed.filter((sig) => sig.trend === 'declining').map((sig) => sig.key))
  switch (view.tone) {
    case 'positive':
      return view.loadUp ? s.positive : s.positiveSteadyLoad
    case 'caution':
      return view.loadUp ? s.cautionLoadUp(slipped.names, slipped.plural) : s.caution
    case 'neutral':
      // Level on one vote only because the reads moved both ways.
      return improved.names && slipped.names
        ? s.mixed(capitalized(improved.names), improved.plural, slipped.names, slipped.plural)
        : s.neutral
  }
}

/**
 * What the coach read says, from the numbers the cards print. `headline` is
 * what the card leads with - the load headline when one applies - and `read`
 * the headline the signals back, which the dialog prints above them.
 */
export function coachText(
  view: CoachReadView,
  load: LoadCoachHeadline | null = null,
): { headline: string; read: string; signals: { trend: Trend; text: string }[] } {
  const s = t.analytics.cards.coachRead
  const read = readHeadline(view)
  const headline = load ? loadHeadlineText(load) : read
  const signals = view.signals.map((signal) => {
    switch (signal.key) {
      case 'fitness':
        return { trend: signal.trend, text: s.fitness(Math.round(signal.value), formatDelta(Math.round(signal.delta))) }
      case 'threshold': {
        const pace = formatClock(signal.pace)
        const text = signal.trend === 'flat' ? s.thresholdLevel(pace) : signal.delta < 0 ? s.thresholdFaster(pace, Math.abs(signal.delta)) : s.thresholdSlower(pace, signal.delta)
        return { trend: signal.trend, text }
      }
      case 'easy': {
        const pace = formatClock(signal.pace)
        // Inside the noise band it is level, in words and arrow alike (v5.6
        // #3): "1 s faster" sat beside a flat arrow.
        const text = signal.trend === 'flat' ? s.easyLevel(pace) : signal.delta < 0 ? s.easyFaster(pace, Math.abs(signal.delta)) : s.easySlower(pace, signal.delta)
        return { trend: signal.trend, text }
      }
      case 'predictions': {
        const text =
          signal.trend === 'declining' ? s.predictionsSlower(signal.slower, signal.count) : signal.trend === 'improving' ? s.predictionsFaster(signal.faster, signal.count) : s.predictionsHeld
        return { trend: signal.trend, text }
      }
      case 'efficiency': {
        const value = formatDecimal(signal.value, 2)
        const delta = formatDeltaFixed(signal.delta, 2)
        const text = signal.trend === 'flat' ? s.efficiencyLevel(value) : signal.trend === 'improving' ? s.efficiencyUp(value, delta) : s.efficiencyDown(value, delta)
        return { trend: signal.trend, text }
      }
      case 'volume': {
        const delta = formatDelta(Math.round(signal.delta))
        return { trend: signal.trend, text: signal.since ? s.volumeSince(delta, bare(signal.since)) : s.volume(delta) }
      }
    }
  })
  return { headline, read, signals }
}

/**
 * What the headline means, as the eyebrow's status colour (v4.17): speed
 * that slipped or load past its range is caution, speed that improved or load
 * building inside its range good news, a level read muted.
 */
export function coachTone(view: CoachReadView, load: LoadCoachHeadline | null): StatTone {
  if (load) return load.kind === 'building' ? 'pos' : 'warn'
  return view.tone === 'positive' ? 'pos' : view.tone === 'caution' ? 'warn' : 'muted'
}

/**
 * A trend's arrow in its meaning (v4.17): ↗ improving pos, → level muted,
 * ↘ worse warn. Never the accent, because a trend is not the athlete's data.
 */
const TREND_ICON: Record<Trend, { Icon: typeof ArrowRight; color: string }> = {
  improving: { Icon: ArrowUpRight, color: DELTA_TONE_COLOR.good },
  flat: { Icon: ArrowRight, color: DELTA_TONE_COLOR.flat },
  declining: { Icon: ArrowDownRight, color: DELTA_TONE_COLOR.worse },
}

/**
 * The coach read, from the board (v4.6, v4.16.4): the Performance and Volume
 * cards at their defaults (12 weeks, today), from the very values they print -
 * fitness over the same 12 weeks, since "Load is up" is set against them.
 * `loadWindow` is the Load tab's window, which the load headline reads.
 */
export function coachReadOf(data: AnalyticsBoardData, today: string, loadWindow: DayWindow): { view: CoachReadView; load: LoadCoachHeadline | null } | null {
  const perf = dayWindow(today, '12w')
  const perfWeeks = weeksIn(data.weeks, perf)
  const fitness = formView(data.load, perf)
  const view = coachRead({
    easy: paceShift(perfWeeks, (w) => w.easyPace),
    predictions: predictionRows(data.predictions, perf),
    efficiency: efficiencyView(data.weeks, perfWeeks, perf.end),
    fitnessDelta: fitness?.fitnessDelta ?? null,
    fitness: fitness?.fitness ?? null,
    threshold: thresholdShift(data.threshold, perf),
    ytd: data.ytd?.vsLastYear ?? null,
  })
  if (!view) return null
  // Load trend, the Load ratio and the coach read share one acute/chronic
  // series and one y range per athlete (v5.4).
  const yMax = loadTrendYMax(data.loads, today)
  return { view, load: loadCoachHeadline(loadTrendView(data.loads, loadWindow, yMax), recoveryView(data.recovery, loadWindow)) }
}

/**
 * The coach read card (v4.17), over every tab: a status eyebrow, the one
 * headline and "Why →"; the reads behind it open in the page's dialog, with
 * Adjust plan as the way to act on them.
 */
export function CoachRead({ view, load }: { view: CoachReadView; load: LoadCoachHeadline | null }) {
  const s = t.analytics.cards.coachRead
  const [open, setOpen] = useState(false)
  const text = coachText(view, load)
  const tone = coachTone(view, load)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-testid="coach-read"
        data-tone={view.tone}
        data-load={load?.kind}
        className="flex items-center gap-3.5 rounded-2xl border border-border bg-card px-5 py-4 text-left transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {/* The read's own 12 weeks on the card too: under a tab set to 4w, a
              bare "Coach read" read as those 4 weeks (v4.16.4). */}
          <VerdictEyebrow tone={tone}>{s.eyebrow}</VerdictEyebrow>
          <span className="text-[15px] font-semibold leading-snug text-foreground text-pretty" data-testid="coach-read-headline">
            {text.headline}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-medium text-accent-text">{s.why}</span>
      </button>
      {open && (
        // The dialog leads with the card's headline (v5.6 L1). A load headline
        // is not what the speed reads back, so their own headline heads them
        // (v4.16.4): "Load jumped 30%" sat over six lines about pace.
        <Dialog
          title={text.headline}
          eyebrow={s.eyebrow}
          eyebrowTone={tone}
          onClose={() => setOpen(false)}
          actions={
            // Where the plan is adjusted today: the Plan page.
            <ButtonLink href="/plan" data-testid="coach-adjust-plan">
              {s.adjustPlan}
            </ButtonLink>
          }
        >
          <div className="flex flex-col">
            {load && (
              <p className="border-t border-border py-2.5 text-sm font-semibold leading-snug text-foreground" data-testid="coach-read-speed">
                {text.read}
              </p>
            )}
            <ul className="flex flex-col">
              {text.signals.map((signal, i) => {
                const { Icon, color } = TREND_ICON[signal.trend]
                return (
                  <li key={i} className="flex gap-3 border-t border-border py-2.5 text-sm leading-[1.45] text-[var(--text-2)]" data-trend={signal.trend}>
                    <Icon size={16} strokeWidth={2.4} className="mt-0.5 w-[18px] shrink-0" style={{ color }} aria-hidden />
                    {signal.text}
                  </li>
                )
              })}
            </ul>
          </div>
        </Dialog>
      )}
    </>
  )
}
