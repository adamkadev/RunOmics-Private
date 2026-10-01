'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { ShoeComparisonRow } from '@/application/usecases/GetShoeComparison'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { formatClock, formatEraRange, formatNumber, MINUS, PLUS_MINUS } from '@/lib/formatters'
import { shortShoeName } from '@/domain/shoe/shortName'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  rows: ShoeComparisonRow[]
}

type MetricGroup = 'howMuch' | 'howItRan'
type NoiseMetric = 'pace' | 'heartRate' | 'cadence' | 'groundContact' | 'oscillation'

type MetricRow = {
  key: string
  group: MetricGroup
  label: string
  value: (row: ShoeComparisonRow) => string
  raw: (row: ShoeComparisonRow) => number | null
  formatDelta: (diff: number) => string
  // Only "how it ran" metrics get a noise floor - counts are exact, so any
  // gap between them is a real difference, never a rounding artefact.
  noise?: { key: NoiseMetric; threshold: number }
}

const COMPARED_PAIRS = 2

// Below this many runs, an average is six or seven data points pretending to
// be a rate - real enough to display, not solid enough to call a difference.
// Counts don't need this floor: 130 vs 87 is a fact regardless of sample size.
const MIN_SESSIONS_FOR_AVERAGES = 15

/** "pace differs…" opened the footnote in lower case. */
function sentenceCase(text: string): string {
  return text.charAt(0).toLocaleUpperCase(t.locale) + text.slice(1)
}

function fmtSigned(n: number, unit = ''): string {
  if (n === 0) return `${PLUS_MINUS}0${unit}`
  return `${n > 0 ? '+' : MINUS}${formatNumber(Math.abs(n))}${unit}`
}

// The unit lives in the row label (see i18n `comparison.metrics`), not a
// second span next to every value - a 78px label column has no room to also
// print "km"/"bpm" per row.
const METRICS: MetricRow[] = [
  {
    key: 'sessions',
    group: 'howMuch',
    label: t.shoes.comparison.metrics.sessions,
    value: (r) => `${r.sessionCount}`,
    raw: (r) => r.sessionCount,
    formatDelta: (d) => fmtSigned(Math.round(d)),
  },
  {
    key: 'distance',
    group: 'howMuch',
    label: t.shoes.comparison.metrics.distance,
    // Whole kilometres here, not the one-decimal `formatDistance` used for a
    // single run's own distance - a 620.1 km lifetime total is one rounding
    // step of false precision past what anyone reads off this row.
    value: (r) => `${Math.round(r.totalKm)}`,
    raw: (r) => r.totalKm,
    formatDelta: (d) => fmtSigned(Math.round(d)),
  },
  {
    key: 'keyShare',
    group: 'howMuch',
    label: t.shoes.comparison.metrics.keyShare,
    value: (r) => `${r.keySessionPercent}${t.units.percent}`,
    raw: (r) => r.keySessionPercent,
    formatDelta: (d) => fmtSigned(Math.round(d)),
  },
  {
    key: 'pace',
    group: 'howItRan',
    label: t.shoes.comparison.metrics.pace,
    value: (r) => (r.paceSecPerKm ? formatClock(r.paceSecPerKm) : '-'),
    raw: (r) => r.paceSecPerKm,
    formatDelta: (d) => fmtSigned(Math.round(d), 's'),
    noise: { key: 'pace', threshold: 5 },
  },
  {
    key: 'heartRate',
    group: 'howItRan',
    label: t.shoes.comparison.metrics.heartRate,
    value: (r) => (r.avgHeartRate ? `${r.avgHeartRate}` : '-'),
    raw: (r) => r.avgHeartRate,
    formatDelta: (d) => fmtSigned(Math.round(d)),
    noise: { key: 'heartRate', threshold: 3 },
  },
  {
    key: 'cadence',
    group: 'howItRan',
    label: t.shoes.comparison.metrics.cadence,
    value: (r) => (r.cadenceSpm ? formatNumber(r.cadenceSpm) : '-'),
    raw: (r) => r.cadenceSpm,
    formatDelta: (d) => fmtSigned(Math.round(d * 10) / 10),
    noise: { key: 'cadence', threshold: 2 },
  },
  {
    key: 'groundContact',
    group: 'howItRan',
    label: t.shoes.comparison.metrics.groundContact,
    value: (r) => (r.groundContactMs ? formatNumber(r.groundContactMs) : '-'),
    raw: (r) => r.groundContactMs,
    formatDelta: (d) => fmtSigned(Math.round(d)),
    noise: { key: 'groundContact', threshold: 5 },
  },
  {
    key: 'oscillation',
    group: 'howItRan',
    label: t.shoes.comparison.metrics.oscillation,
    value: (r) => (r.verticalOscillationMm ? formatNumber(r.verticalOscillationMm) : '-'),
    raw: (r) => r.verticalOscillationMm,
    formatDelta: (d) => fmtSigned(Math.round(d * 10) / 10),
    noise: { key: 'oscillation', threshold: 2 },
  },
]

const METRIC_GROUPS: MetricGroup[] = ['howMuch', 'howItRan']

// 78px label / 1fr / 1fr / 48px delta, 6px gaps - fixed so the table never
// scrolls. A value that would clip at this width is the table's problem to
// fix (shorten the label, drop the unit), never the viewport's.
const GRID_COLS = 'grid-cols-[78px_1fr_1fr_48px]'

function metricDelta(
  metric: MetricRow,
  a: ShoeComparisonRow,
  b: ShoeComparisonRow,
  enoughForAverages: boolean
): { text: string; beyond: boolean } | null {
  if (metric.group === 'howItRan' && !enoughForAverages) return null
  const va = metric.raw(a)
  const vb = metric.raw(b)
  if (va == null || vb == null) return null
  // First column minus second, not the other way round - the column order
  // reads left to right as the reference, so a bigger first-column number
  // shows positive rather than a "the bigger pair reads negative" reversal.
  const diff = va - vb
  if (!metric.noise) return { text: metric.formatDelta(diff), beyond: true }
  // Strictly greater than, not "at least": a gap that lands exactly on the
  // threshold is still within it, not past it.
  const beyond = Math.abs(diff) > metric.noise.threshold
  return { text: beyond ? metric.formatDelta(diff) : t.shoes.comparison.same, beyond }
}

// The pairs still in rotation are the ones a runner is actually deciding
// between - a retired pair only belongs in the default pick when there
// aren't two active ones to fill it with.
function defaultPicks(rows: ShoeComparisonRow[]): string[] {
  const active = rows.filter((r) => !r.retired)
  const retired = rows.filter((r) => r.retired)
  return [...active, ...retired].slice(0, COMPARED_PAIRS).map((r) => r.gearId)
}

export function ShoeComparison({ rows }: Props) {
  const [picked, setPicked] = useState<string[]>(() => defaultPicks(rows))
  const [pickerOpen, setPickerOpen] = useState(false)

  if (rows.length < COMPARED_PAIRS) return null

  const compared = picked
    .map((gearId) => rows.find((r) => r.gearId === gearId))
    .filter((row): row is ShoeComparisonRow => row !== undefined)
  if (compared.length < COMPARED_PAIRS) return null

  function pick(gearId: string) {
    setPicked((current) =>
      current.includes(gearId) ? current : [...current.slice(1 - COMPARED_PAIRS), gearId],
    )
  }

  const enoughForAverages =
    compared[0]!.sessionCount >= MIN_SESSIONS_FOR_AVERAGES && compared[1]!.sessionCount >= MIN_SESSIONS_FOR_AVERAGES
  const tooFewRunsSentence = enoughForAverages
    ? null
    : t.shoes.comparison.tooFewRuns(
        new Intl.ListFormat(t.locale, { style: 'long', type: 'conjunction' }).format(
          compared
            .filter((row) => row.sessionCount < MIN_SESSIONS_FOR_AVERAGES)
            .map((row) => t.shoes.comparison.tooFewRunsShoe(shortShoeName(row.name, row.brand), row.sessionCount))
        ),
        MIN_SESSIONS_FOR_AVERAGES
      )

  const beyondNoiseNames = METRICS
    .filter((m): m is MetricRow & { noise: NonNullable<MetricRow['noise']> } => m.noise !== undefined)
    .filter((m) => metricDelta(m, compared[0]!, compared[1]!, enoughForAverages)?.beyond)
    .map((m) => t.shoes.comparison.metricNames[m.noise.key])
  // With too few runs, no averages claim is safe to make at all - the season
  // caveat still applies, but it's the only sentence left standing.
  const averagesSentence = !enoughForAverages
    ? null
    : beyondNoiseNames.length > 0
      ? t.shoes.comparison.beyondNoise(new Intl.ListFormat(t.locale, { style: 'long', type: 'conjunction' }).format(beyondNoiseNames))
      : t.shoes.comparison.noneBeyondNoise

  return (
    <section className="space-y-2.5">
      {/* The row that opens this carries the title. */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          aria-label={t.shoes.comparison.changeLabel}
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent-text"
        >
          {t.shoes.comparison.change}
          <ChevronDown size={14} className={cn('transition-transform', pickerOpen && 'rotate-180')} />
        </button>
      </div>

      {pickerOpen && (
        <div className="rounded-card border border-border p-1.5">
          <p className="px-2 pb-1.5 pt-1 text-caption text-subtle-2">{t.shoes.comparison.pickHint}</p>
          {rows.map((row) => {
            const selected = picked.includes(row.gearId)
            return (
              <button
                key={row.gearId}
                type="button"
                onClick={() => pick(row.gearId)}
                aria-pressed={selected}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-foreground/[0.06]"
              >
                <BrandIcon brand={row.brand} size={14} />
                <span className="min-w-0 flex-1 truncate text-footnote text-foreground">{row.name}</span>
                {selected && <Check size={14} strokeWidth={3} className="shrink-0 text-accent-text" />}
              </button>
            )
          })}
        </div>
      )}

      <div className={cn('grid gap-x-1.5 gap-y-2 rounded-card border border-border p-3', GRID_COLS)}>
        <div />
        {compared.map((row) => (
          <div key={row.gearId} className="min-w-0">
            <span className="flex items-start gap-1.5">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.dotColor }} />
              {/* Wraps rather than truncating: "Tempo Ra…" named neither pair. */}
              <span className="min-w-0 break-words text-sm font-semibold leading-tight text-foreground">
                {row.name}
              </span>
            </span>
            <span className="mt-0.5 block truncate text-caption font-normal text-subtle-2">
              {formatEraRange(row.firstUsed, row.lastUsed)}
            </span>
          </div>
        ))}
        <span className="self-end pb-1 text-right text-caption font-medium text-subtle-2">{t.shoes.comparison.delta}</span>

        {METRIC_GROUPS.map((group) => (
          <Fragment key={group}>
            <div className="col-span-4 pb-0.5 pt-1.5 text-caption font-semibold uppercase tracking-[0.08em] text-subtle-2">
              {t.shoes.comparison.groups[group]}
            </div>
            {METRICS.filter((metric) => metric.group === group).map((metric) => {
              const delta = metricDelta(metric, compared[0]!, compared[1]!, enoughForAverages)
              return (
                <Fragment key={metric.key}>
                  <span className="border-t border-border pt-2 text-xs font-medium text-muted-foreground">{metric.label}</span>
                  {compared.map((row) => (
                    <span key={row.gearId} className="truncate border-t border-border pt-2 tabular-nums text-foreground">
                      {metric.value(row)}
                    </span>
                  ))}
                  <span
                    className={cn(
                      'truncate border-t border-border pt-2 text-right tabular-nums',
                      delta?.beyond ? 'font-semibold text-foreground' : 'text-subtle-2'
                    )}
                  >
                    {delta ? delta.text : '-'}
                  </span>
                </Fragment>
              )
            })}
            {group === 'howItRan' && tooFewRunsSentence && (
              <div className="col-span-4 pt-1 text-caption italic text-subtle-2">{tooFewRunsSentence}</div>
            )}
          </Fragment>
        ))}
        {/* In the card, not under it. The season caveat only qualifies an
            averages claim - with too few runs there's nothing for it to hedge. */}
        {averagesSentence && (
          <p className="col-span-4 border-t border-border pt-2 text-caption text-subtle-2">
            {sentenceCase(averagesSentence)} {t.shoes.comparison.note}
          </p>
        )}
      </div>
    </section>
  )
}
