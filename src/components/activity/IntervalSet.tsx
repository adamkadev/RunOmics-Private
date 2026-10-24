'use client'

import type { ActivitySplit } from '@/domain/activity/types'
import { type RepSet, type Track, recoveryAverage, trackDomain, trackPosition } from '@/domain/activity/repSet'
import { cardClass } from '@/components/ui/Card'
import { Stat, StatGrid } from '@/components/ui/Stat'
import { formatClock, formatDelta, formatKm } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  set: RepSet
  /** No card of its own: it sits inside the Splits card. */
  bare?: boolean
}

const ROW = 'grid w-full items-center gap-x-2.5 grid-cols-[1.375rem_minmax(0,1fr)_3rem_2.25rem]'
const MUTED_CELL = 'text-right tabular-nums text-muted-foreground'

function km(distanceM: number): string {
  return formatKm(distanceM / 1000, 2)
}

function paceOf(split: ActivitySplit): number | null {
  return split.distanceM > 0 ? Math.round((split.durationSec / split.distanceM) * 1000) : null
}

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

/** A tick on a track, faster to the right: a filled bar would read as a score out of 100. */
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

export function IntervalSet({ set, bare = false }: Props) {
  const s = t.activity.splits
  const inBandAll = set.band !== null && set.inBand === set.reps.length
  const track = trackDomain(set)
  const band = set.band
  const recovery = recoveryAverage(set.reps)
  const warmupLabel = s.intervalTypes.interval_warmup ?? ''
  const cooldownLabel = s.intervalTypes.interval_cooldown ?? ''
  const stridePaces = set.reps.map((r) => r.paceSecPerKm).filter((p): p is number => p !== null)
  const strideMetres = set.reps.reduce((sum, r) => sum + r.distanceM, 0)
  const strideAverage = strideMetres > 0 ? Math.round((set.reps.reduce((sum, r) => sum + r.durationSec, 0) / strideMetres) * 1000) : null

  return (
    <section className={bare ? 'flex flex-col gap-3' : cardClass({ className: 'flex flex-col gap-3' })} data-testid="interval-set">
      <div data-testid="set-summary">
        {set.strides ? (
          // 20 s accelerations: the heart rate lags them, so a band, a spread or a drift would grade noise.
          <StatGrid columns={3}>
            <Stat label={s.stridesLabel} value={set.reps.length} />
            <Stat label={s.fastest} value={stridePaces.length ? formatClock(Math.min(...stridePaces)) : '—'} />
            <Stat label={s.average} value={strideAverage ? formatClock(strideAverage) : '—'} />
          </StatGrid>
        ) : (
        <StatGrid columns={3}>
          {band ? (
            <Stat
              label={s.inBandLabel}
              value={`${set.inBand}/${set.reps.length}`}
              valueStyle={{ color: inBandAll ? 'var(--pos)' : 'var(--warn)' }}
            />
          ) : null}
          <Stat label={s.spread} value={set.spreadSecPerKm ?? '—'} unit={set.spreadSecPerKm != null ? t.units.sec : undefined} />
          {/* A drift, not a verdict: neutral ink. */}
          <Stat
            label={s.hrDrift}
            value={set.hrDriftBpm === null ? '—' : formatDelta(set.hrDriftBpm)}
            unit={set.hrDriftBpm !== null ? t.units.bpm : undefined}
          />
        </StatGrid>
        )}
      </div>

      <div className="h-px bg-[var(--border)]" />

      <div className="flex flex-col gap-2">
        <div className={cn(ROW, 'text-caption uppercase tracking-[0.06em] text-muted-foreground')}>
          <span>{s.cols.step}</span>
          <span className="truncate normal-case tracking-normal" data-testid="band-header">
            {band && !set.strides ? s.bandLabel(`${formatClock(band.min)}–${formatClock(band.max)}`) : ''}
          </span>
          <span className="text-right">{s.cols.pace}</span>
          <span className="text-right">{s.cols.hr}</span>
        </div>

        {set.warmups.map((lap, i) => (
          <QuietRow key={`w${i}`} label={`${warmupLabel} ${km(lap.distanceM)} ${t.units.km}`} pace={paceOf(lap)} hr={lap.avgHr} />
        ))}

        {set.body && <QuietRow label={`${s.bodyLap} ${km(set.body.distanceM)} ${t.units.km}`} pace={paceOf(set.body)} hr={set.body.avgHr} />}

        {set.reps.map((rep) => {
          const standing = standingOf(rep.paceSecPerKm, band)
          return (
            <div key={rep.number} className={cn(ROW, 'min-h-6 text-subhead')} data-testid="rep-row">
              <span className="tabular-nums text-foreground">{rep.number}</span>
              {track && !set.strides ? <RepTrack pace={rep.paceSecPerKm} track={track} band={band} standing={standing} /> : <span />}
              <span className={cn('text-right font-bold tabular-nums', standing === 'slower' ? 'text-muted-foreground' : 'text-foreground')}>
                {rep.paceSecPerKm ? formatClock(rep.paceSecPerKm) : '–'}
              </span>
              <span className="text-right tabular-nums text-foreground">{rep.avgHr ?? '–'}</span>
            </div>
          )
        })}

        {recovery && <QuietRow label={s.recoveryAvg} pace={recovery.paceSecPerKm} hr={recovery.avgHr} />}

        {set.cooldowns.map((lap, i) => (
          <QuietRow key={`c${i}`} label={`${cooldownLabel} ${km(lap.distanceM)} ${t.units.km}`} pace={paceOf(lap)} hr={lap.avgHr} />
        ))}
      </div>
    </section>
  )
}
