'use client'

import { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { SectionDivider } from '@/components/ui/SectionLabel'
import type { ShoeComparisonRow } from '@/application/usecases/GetShoeComparison'
import { BrandIcon } from '@/components/shoes/BrandIcon'
import { formatDate, formatDistance, formatPace } from '@/lib/formatters'
import { shortShoeName } from '@/domain/shoe/shortName'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  rows: ShoeComparisonRow[]
}

type MetricRow = { label: string; value: (row: ShoeComparisonRow) => string }

const COMPARED_PAIRS = 2

const METRICS: MetricRow[] = [
  { label: t.shoes.comparison.metrics.sessions, value: (r) => `${r.sessionCount}` },
  { label: t.shoes.comparison.metrics.distance, value: (r) => `${formatDistance(r.totalKm)} ${t.units.km}` },
  { label: t.shoes.comparison.metrics.keyShare, value: (r) => `${r.keySessionPercent}${t.units.percent}` },
  { label: t.shoes.comparison.metrics.pace, value: (r) => (r.paceSecPerKm ? formatPace(r.paceSecPerKm) : '-') },
  { label: t.shoes.comparison.metrics.heartRate, value: (r) => (r.avgHeartRate ? `${r.avgHeartRate} ${t.units.bpm}` : '-') },
  { label: t.shoes.comparison.metrics.cadence, value: (r) => (r.cadenceSpm ? `${r.cadenceSpm} ${t.units.spm}` : '-') },
  { label: t.shoes.comparison.metrics.groundContact, value: (r) => (r.groundContactMs ? `${r.groundContactMs} ${t.units.ms}` : '-') },
  { label: t.shoes.comparison.metrics.oscillation, value: (r) => (r.verticalOscillationMm ? `${r.verticalOscillationMm} ${t.units.mm}` : '-') },
]

export function ShoeComparison({ rows }: Props) {
  const [picked, setPicked] = useState<string[]>(() => rows.slice(0, COMPARED_PAIRS).map((r) => r.gearId))
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

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <SectionDivider>{t.shoes.comparison.title}</SectionDivider>
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
          <p className="px-2 pb-1.5 pt-1 text-micro text-subtle-2">{t.shoes.comparison.pickHint}</p>
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

      <div className="relative">
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 bg-background px-3 py-2.5 text-left" />
                {compared.map((row) => (
                  <th key={row.gearId} scope="col" className="px-3 py-2.5 text-left align-bottom">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.dotColor }}
                      />
                      <span className="max-w-[9ch] truncate font-semibold text-foreground" title={row.name}>
                        {shortShoeName(row.name, row.brand)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-micro font-normal text-subtle-2">
                      {t.shoes.comparison.period(
                        formatDate(row.firstUsed, { precision: 'month', year: 'never' }),
                        formatDate(row.lastUsed, { precision: 'month', year: 'never' }),
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric) => (
                <tr key={metric.label} className="border-t border-border">
                  <th scope="row" className="sticky left-0 bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    {metric.label}
                  </th>
                  {compared.map((row) => (
                    <td key={row.gearId} className="px-3 py-2 tabular-nums text-foreground">
                      {metric.value(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-card bg-gradient-to-l from-background to-transparent"
        />
      </div>

      <p className="px-1 text-caption text-subtle-2">{t.shoes.comparison.note}</p>
    </section>
  )
}
