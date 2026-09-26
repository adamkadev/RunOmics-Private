'use client'

import type { ActivitySplit } from '@/domain/activity/types'
import { type RepSet, type Track, recoveryAverage, trackDomain, trackPosition } from '@/domain/activity/repSet'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { STATUS } from '@/lib/statusColors'
import { formatClock, formatDelta } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  set: RepSet
}

const ROW = 'grid w-full items-center gap-x-2.5 grid-cols-[1.375rem_minmax(0,1fr)_3rem_2.25rem]'
const MUTED_CELL = 'text-right tabular-nums text-muted-foreground'

function km(distanceM: number): string {
  return (distanceM / 1000).toFixed(2)
}

function paceOf(split: ActivitySplit): number | null {
  return split.distanceM > 0 ? Math.round((split.durationSec / split.distanceM) * 1000) : null
}

/** Warm-up, the recoveries and the cool-down: one quiet row each. */
function QuietRow({ label, pace, hr }: { label: string; pace: number | null; hr: number | null }) {
  return (
    <div className={cn(ROW, 'min-h-6 text-subhead')}>
      <span className="text-subtle-2">·</span>
      <span className="truncate text-muted-foreground">{label}</span>
      <span className={MUTED_CELL}>{pace ? formatClock(pace) : '–'}</span>
      <span className={MUTED_CELL}>{hr ?? '–'}</span>
    </div>
  )
}

type RepStanding = 'faster' | 'inBand' | 'slower'

const TICK_CLASS: Record<RepStanding, string> = {
  faster: 'bg-accent',
  inBand: 'bg-accent',
  slower: 'bg-muted-foreground',
}

function standingOf(pace: number | null, band: RepSet['band']): RepStanding {
  if (pace === null || !band) return 'slower'
  if (pace < band.min) return 'faster'
  return pace <= band.max ? 'inBand' : 'slower'
}

/**
 * The rep on a track (H15): the band is the shaded zone, the rep's pace a
 * tick - faster to the right. A filled bar read as a score out of 100.
 */
function RepTrack({ pace, track, band, standing }: { pace: number | null; track: Track; band: RepSet['band']; standing: RepStanding }) {
  const at = pace !== null ? trackPosition(pace, track) * 100 : null
  const bandStart = band ? trackPosition(band.max, track) * 100 : null
  const bandEnd = band ? trackPosition(band.min, track) * 100 : null

  return (
    <span className="relative block h-2 w-full rounded-full bg-[var(--track)]" data-testid="rep-track">
      {bandStart !== null && bandEnd !== null && (
        <span
          aria-hidden="true"
          data-testid="rep-band"
          className="absolute inset-y-0 bg-[var(--band)]"
          style={{ left: `${bandStart}%`, width: `${Math.max(bandEnd - bandStart, 1)}%` }}
        />
      )}
      {at !== null && (
        <span
          aria-hidden="true"
          data-testid="rep-tick"
          className={cn('absolute -top-[3px] -bottom-[3px] w-1 rounded-sm', TICK_CLASS[standing])}
          style={{ left: `calc(${Math.min(Math.max(at, 0), 100)}% - 2px)` }}
        />
      )}
    </span>
  )
}

/**
 * The set per M10: three numbers, then warm-up, a track per rep, the
 * recoveries as one average row, and the cool-down, in one card.
 */
export function IntervalSet({ set }: Props) {
  const s = t.activity.splits
  const inBandAll = set.band !== null && set.inBand === set.reps.length
  const track = trackDomain(set)
  const band = set.band
  const recovery = recoveryAverage(set.reps)
  const warmupLabel = s.intervalTypes.interval_warmup ?? ''
  const cooldownLabel = s.intervalTypes.interval_cooldown ?? ''

  return (
    <GlassSurface variant="card" className="flex flex-col gap-3 rounded-[22px] px-4.5 py-4" data-testid="interval-set">
      {/* The set in three numbers, at the top, with no sentence (H14). */}
      <div className="grid grid-cols-3 gap-2" data-testid="set-summary">
        {band && (
          <div className="flex flex-col gap-0.75">
            <p className={cn('font-display text-title3 font-bold leading-none tabular-nums', inBandAll ? STATUS.success.text : STATUS.warning.text)}>
              {set.inBand}/{set.reps.length}
            </p>
            <p className="text-caption text-muted-foreground">{s.inBandLabel}</p>
          </div>
        )}
        <div className="flex flex-col gap-0.75">
          <p className="font-display text-title3 font-bold leading-none tabular-nums text-foreground">
            {set.spreadSecPerKm ?? '—'} <span className="text-footnote font-normal">{t.units.sec}</span>
          </p>
          <p className="text-caption text-muted-foreground">{s.spread}</p>
        </div>
        <div className="flex flex-col gap-0.75">
          {/* A drift, not a verdict: neutral ink and its unit (v4.3). */}
          <p className="font-display text-title3 font-bold leading-none tabular-nums text-foreground">
            {set.hrDriftBpm === null ? '—' : formatDelta(set.hrDriftBpm)}
            {set.hrDriftBpm !== null && <span className="text-footnote font-normal"> {t.units.bpm}</span>}
          </p>
          <p className="text-caption text-muted-foreground">{s.hrDrift}</p>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-2">
        <div className={cn(ROW, 'text-caption text-subtle-2')}>
          <span>{s.cols.step}</span>
          <span className="truncate" data-testid="band-header">
            {band ? s.bandLabel(`${formatClock(band.min)}–${formatClock(band.max)}`) : ''}
          </span>
          <span className="text-right uppercase">{s.cols.pace}</span>
          <span className="text-right uppercase">{s.cols.hr}</span>
        </div>

        {set.warmup && <QuietRow label={`${warmupLabel} ${km(set.warmup.distanceM)} ${t.units.km}`} pace={paceOf(set.warmup)} hr={set.warmup.avgHr} />}

        {set.reps.map((rep) => {
          const standing = standingOf(rep.paceSecPerKm, band)
          return (
            <div key={rep.number} className={cn(ROW, 'min-h-6 text-subhead')} data-testid="rep-row">
              <span className="tabular-nums text-foreground">{rep.number}</span>
              {track ? <RepTrack pace={rep.paceSecPerKm} track={track} band={band} standing={standing} /> : <span />}
              <span className={cn('text-right font-bold tabular-nums', standing === 'slower' ? 'text-muted-foreground' : 'text-foreground')}>
                {rep.paceSecPerKm ? formatClock(rep.paceSecPerKm) : '–'}
              </span>
              <span className="text-right tabular-nums text-foreground">{rep.avgHr ?? '–'}</span>
            </div>
          )
        })}

        {recovery && <QuietRow label={s.recoveryAvg} pace={recovery.paceSecPerKm} hr={recovery.avgHr} />}

        {set.cooldown && <QuietRow label={`${cooldownLabel} ${km(set.cooldown.distanceM)} ${t.units.km}`} pace={paceOf(set.cooldown)} hr={set.cooldown.avgHr} />}
      </div>
    </GlassSurface>
  )
}
