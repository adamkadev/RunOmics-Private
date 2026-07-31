'use client'

import { useState } from 'react'
import type { LoadRiskPanel as LoadRiskPanelData, RiskZone } from '@/application/usecases/GetLoadRiskPanel'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

const ZONE_TONE: Record<RiskZone, StatusTone> = {
  low: 'blue',
  safe: 'green',
  caution: 'amber',
  risk: 'red',
}

const ZONE_TEXT: Record<RiskZone, string> = {
  low: 'text-blue-600 dark:text-blue-400',
  safe: 'text-foreground',
  caution: 'text-amber-600 dark:text-amber-400',
  risk: 'text-red-600 dark:text-red-400',
}

// The band holding the value carries full colour; the rest stay faint so the
// eye lands on where the athlete actually sits, not on the whole ladder.
const BAND_ACTIVE: Record<RiskZone, string> = {
  low: 'bg-blue-500',
  safe: 'bg-green-500',
  caution: 'bg-amber-500',
  risk: 'bg-red-500',
}

const BAND_DIM: Record<RiskZone, string> = {
  low: 'bg-blue-500/20',
  safe: 'bg-green-500/20',
  caution: 'bg-amber-500/25',
  risk: 'bg-red-500/25',
}

const ZONE_SEVERITY: Record<RiskZone, number> = { low: 0, safe: 0, caution: 1, risk: 2 }

interface Scale {
  min: number
  max: number
  bands: { from: number; to: number; zone: RiskZone }[]
  ticks: { at: number; label: string }[]
}

const ACWR_SCALE: Scale = {
  min: 0.5,
  max: 2,
  bands: [
    { from: 0.5, to: 0.8, zone: 'low' },
    { from: 0.8, to: 1.3, zone: 'safe' },
    { from: 1.3, to: 1.5, zone: 'caution' },
    { from: 1.5, to: 2, zone: 'risk' },
  ],
  ticks: [
    { at: 0.8, label: '0.8' },
    { at: 1.3, label: '1.3' },
    { at: 1.5, label: '1.5' },
  ],
}

const MONOTONY_SCALE: Scale = {
  min: 0.5,
  max: 2.5,
  bands: [
    { from: 0.5, to: 1.5, zone: 'safe' },
    { from: 1.5, to: 2, zone: 'caution' },
    { from: 2, to: 2.5, zone: 'risk' },
  ],
  ticks: [
    { at: 1.5, label: '1.5' },
    { at: 2, label: '2.0' },
  ],
}

const RAMP_SCALE: Scale = {
  min: -10,
  max: 10,
  bands: [
    { from: -10, to: -8, zone: 'risk' },
    { from: -8, to: -5, zone: 'caution' },
    { from: -5, to: 5, zone: 'safe' },
    { from: 5, to: 8, zone: 'caution' },
    { from: 8, to: 10, zone: 'risk' },
  ],
  ticks: [
    { at: -8, label: '-8' },
    { at: -5, label: '-5' },
    { at: 5, label: '+5' },
    { at: 8, label: '+8' },
  ],
}

function pct(value: number, scale: Scale): number {
  return Math.min(100, Math.max(0, ((value - scale.min) / (scale.max - scale.min)) * 100))
}

function ZoneTrack({ scale, value }: { scale: Scale; value: number }) {
  const clamped = Math.min(scale.max, Math.max(scale.min, value))

  return (
    <div className="mt-2">
      <div className="relative h-2">
        <div className="absolute inset-0 overflow-hidden rounded-full bg-foreground/[0.06]">
          {scale.bands.map((band) => (
            <span
              key={band.to}
              className={cn(
                'absolute inset-y-0',
                clamped >= band.from && (clamped < band.to || band.to === scale.max)
                  ? BAND_ACTIVE[band.zone]
                  : BAND_DIM[band.zone]
              )}
              style={{ left: `${pct(band.from, scale)}%`, width: `${pct(band.to, scale) - pct(band.from, scale)}%` }}
            />
          ))}
        </div>
        <span
          className="absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-1 ring-background"
          style={{ left: `${pct(value, scale)}%` }}
        />
      </div>
      <div className="relative mt-1 h-3">
        {scale.ticks.map((tick) => (
          <span
            key={tick.at}
            className="absolute -translate-x-1/2 text-micro tabular-nums text-muted-foreground"
            style={{ left: `${pct(tick.at, scale)}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  description,
  zone,
  scale,
  rawValue,
  open,
  onToggle,
}: {
  label: string
  value: string
  description: string
  zone: RiskZone | null
  scale: Scale
  rawValue: number | null
  open: boolean
  onToggle: () => void
}) {
  const s = t.loadRisk

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full py-3 text-left transition-opacity active:opacity-70"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="widget-label text-muted-foreground">{label}</span>
          <span className={cn('text-title2 font-extrabold tabular-nums', zone ? ZONE_TEXT[zone] : 'text-muted-foreground')}>
            {value}
          </span>
        </div>
        {rawValue !== null ? (
          <ZoneTrack scale={scale} value={rawValue} />
        ) : (
          <p className="mt-1 text-micro text-muted-foreground">{s.insufficientData}</p>
        )}
      </button>
      {open && <p className="pb-3 text-xs leading-snug text-muted-foreground">{description}</p>}
    </li>
  )
}

export function LoadRiskPanel({ data }: { data: LoadRiskPanelData }) {
  const s = t.loadRisk
  const [open, setOpen] = useState<string | null>(null)
  const toggle = (id: string) => setOpen(open === id ? null : id)

  const zones = [data.acwrZone, data.monotonyZone, data.rampRateZone].filter(
    (z): z is RiskZone => z !== null
  )
  const flagged = zones.filter((z) => ZONE_SEVERITY[z] > 0)
  const worst = flagged.reduce<RiskZone | null>(
    (acc, z) => (acc === null || ZONE_SEVERITY[z] > ZONE_SEVERITY[acc] ? z : acc),
    null
  )

  return (
    <GlassSurface variant="card" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground/80">{s.title}</h2>
        {zones.length > 0 && (
          <StatusPill tone={worst ? ZONE_TONE[worst] : 'green'}>
            {worst ? s.summary.flagged(flagged.length) : s.summary.clear(zones.length)}
          </StatusPill>
        )}
      </div>
      <ul className="mt-1 divide-y divide-foreground/[0.06]">
        <Row
          label={s.acwr.label}
          value={data.acwr !== null ? data.acwr.toFixed(1) : '–'}
          description={data.acwrSource === 'garmin' ? s.acwr.descriptionGarmin : s.acwr.description}
          zone={data.acwrZone}
          scale={ACWR_SCALE}
          rawValue={data.acwr}
          open={open === 'acwr'}
          onToggle={() => toggle('acwr')}
        />
        <Row
          label={s.monotony.label}
          value={data.monotony !== null ? data.monotony.toFixed(1) : '–'}
          description={s.monotony.description}
          zone={data.monotonyZone}
          scale={MONOTONY_SCALE}
          rawValue={data.monotony}
          open={open === 'monotony'}
          onToggle={() => toggle('monotony')}
        />
        <Row
          label={s.rampRate.label}
          value={data.rampRate !== null ? `${data.rampRate >= 0 ? '+' : ''}${data.rampRate}` : '–'}
          description={s.rampRate.description}
          zone={data.rampRateZone}
          scale={RAMP_SCALE}
          rawValue={data.rampRate}
          open={open === 'rampRate'}
          onToggle={() => toggle('rampRate')}
        />
      </ul>
    </GlassSurface>
  )
}
