'use client'

import type { ActivitySplit } from '@/domain/activity/types'
import { type RepSet, type Track, trackDomain, trackPosition, setVerdict } from '@/domain/activity/repSet'
import { GlassSurface } from '@/components/ui/GlassSurface'
import { ChartCardHead } from '@/components/ui/ChartCard'
import { STATUS } from '@/lib/statusColors'
import { formatClock, formatDuration, formatDelta } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

interface Props {
  set: RepSet
}

const ROW = 'grid w-full items-center gap-x-2 grid-cols-[1.25rem_1fr_3rem_2.25rem]'

function km(distanceM: number): string {
  return (distanceM / 1000).toFixed(2)
}

function driftClause(drift: number | null): string {
  const d = t.activity.splits.drift
  if (drift === null) return d.unknown
  if (drift < 0) return d.down(Math.abs(drift))
  return drift === 0 ? d.flat : d.up(drift)
}

function EdgeRow({ split, label }: { split: ActivitySplit; label: string }) {
  const pace = split.distanceM > 0 ? Math.round((split.durationSec / split.distanceM) * 1000) : null
  return (
    <div className={`${ROW} rounded-md px-1 py-1.5`}>
      <span className="text-xs text-subtle-2">·</span>
      <span className="truncate text-xs text-subtle">
        {label} · {formatDuration(split.durationSec)} · {km(split.distanceM)} {t.units.km}
      </span>
      <span className="text-xs tabular-nums text-subtle">{pace ? formatClock(pace) : '-'}</span>
      <span className="text-xs tabular-nums text-subtle">{split.avgHr ?? '-'}</span>
    </div>
  )
}

type RepStanding = 'faster' | 'inBand' | 'slower'

/** Overshooting the band is the best a rep can do, so it gets its own ink. */
const FILL_CLASS: Record<RepStanding, string> = {
  faster: 'bg-sky-500',
  inBand: 'bg-accent',
  slower: 'bg-foreground/30',
}

const PACE_TEXT_CLASS: Record<RepStanding, string> = {
  faster: 'text-sky-600 dark:text-sky-400',
  inBand: 'text-foreground',
  slower: 'text-subtle',
}

function standingOf(pace: number | null, band: RepSet['band']): RepStanding {
  if (pace === null || !band) return 'slower'
  if (pace < band.min) return 'faster'
  return pace <= band.max ? 'inBand' : 'slower'
}

function RepBar({ pace, track, band, standing }: { pace: number | null; track: Track; band: RepSet['band']; standing: RepStanding }) {
  const fill = pace !== null ? trackPosition(pace, track) * 100 : 0
  const bandStart = band ? trackPosition(band.max, track) * 100 : null
  const bandEnd = band ? trackPosition(band.min, track) * 100 : null

  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
      {bandStart !== null && bandEnd !== null && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 bg-accent/20"
          style={{ left: `${bandStart}%`, width: `${Math.max(bandEnd - bandStart, 1)}%` }}
        />
      )}
      <span
        aria-hidden="true"
        className={cn('absolute inset-y-0 left-0 rounded-full', FILL_CLASS[standing])}
        style={{ width: `${fill}%` }}
      />
      {pace !== null && (
        <span
          aria-hidden="true"
          className={cn('absolute inset-y-0 w-0.5 rounded-full', FILL_CLASS[standing])}
          style={{ left: `calc(${fill}% - 1px)` }}
        />
      )}
    </span>
  )
}

export function IntervalSet({ set }: Props) {
  const s = t.activity.splits
  const verdict = setVerdict(set)
  const inBandAll = set.band !== null && set.inBand === set.reps.length
  const track = trackDomain(set)
  const band = set.band

  return (
    <>
      <GlassSurface variant="card" className="p-5">
        <ChartCardHead
          title={s.repSetLabel(set.reps.length, formatClock(set.repDurationSec))}
          controls={
            band && (
              <span className="text-xs text-subtle">
                {s.bandLabel(`${formatClock(band.min)}-${formatClock(band.max)}`)}
              </span>
            )
          }
        />

        <div className="w-full space-y-0.5">
          <div className={`${ROW} pb-1.5 text-caption font-semibold uppercase tracking-wide text-subtle`}>
            <span className="truncate">{s.cols.step}</span>
            <span className="truncate">{s.colFaster}</span>
            <span className="truncate">{s.cols.pace}</span>
            <span className="truncate">{s.cols.hr}</span>
          </div>

          {set.warmup && <EdgeRow split={set.warmup} label={s.intervalTypes.interval_warmup ?? ''} />}

          {set.reps.map((rep) => {
            const standing = standingOf(rep.paceSecPerKm, band)

            return (
              <div key={rep.number}>
                <div className={`${ROW} rounded-md px-1 py-1.5`}>
                  <span className="text-xs font-semibold tabular-nums text-foreground/60">{rep.number}</span>
                  {track ? (
                    <RepBar pace={rep.paceSecPerKm} track={track} band={band} standing={standing} />
                  ) : (
                    <span />
                  )}
                  <span className={cn('text-xs font-semibold tabular-nums', PACE_TEXT_CLASS[standing])}>
                    {rep.paceSecPerKm ? formatClock(rep.paceSecPerKm) : '-'}
                  </span>
                  <span className="text-xs tabular-nums">{rep.avgHr ?? '-'}</span>
                </div>

                {rep.recovery && (
                  <div className={`${ROW} px-1 pb-1.5`}>
                    <span />
                    <span className="truncate text-caption text-subtle-2">
                      {s.recoveryLine(formatDuration(rep.recovery.durationSec), km(rep.recovery.distanceM))}
                    </span>
                    <span className="text-caption tabular-nums text-subtle-2">
                      {rep.recovery.paceSecPerKm ? formatClock(rep.recovery.paceSecPerKm) : ''}
                    </span>
                    <span className="text-caption tabular-nums text-subtle-2">{rep.recovery.avgHr ?? ''}</span>
                  </div>
                )}
              </div>
            )
          })}

          {set.cooldown && <EdgeRow split={set.cooldown} label={s.intervalTypes.interval_cooldown ?? ''} />}
        </div>
      </GlassSurface>

      <GlassSurface variant="card" className="p-5">
        <ChartCardHead title={s.acrossTheSet} className="mb-2" />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-base font-extrabold tabular-nums text-foreground">
              {set.spreadSecPerKm ?? '-'} <span className="text-xs font-normal text-subtle">{t.units.sec}</span>
            </p>
            <p className="text-caption text-subtle">{s.spread}</p>
            {band && (
              <p className={cn('text-caption font-semibold', inBandAll ? STATUS.success.text : STATUS.warning.text)}>
                {s.inBand(set.inBand, set.reps.length)}
              </p>
            )}
          </div>
          <div>
            <p
              className={cn(
                'text-base font-extrabold tabular-nums',
                set.hrDriftBpm === null ? 'text-foreground' : set.hrDriftBpm > 0 ? STATUS.warning.text : STATUS.success.text,
              )}
            >
              {set.hrDriftBpm === null ? '-' : formatDelta(set.hrDriftBpm)}{' '}
              <span className="text-xs font-normal text-subtle">{t.units.bpm}</span>
            </p>
            <p className="text-caption text-subtle">{s.repHrDrift}</p>
          </div>
          <div>
            <p className="text-base font-extrabold tabular-nums text-foreground">
              {set.meanRecoverySecPerKm !== null ? formatClock(set.meanRecoverySecPerKm) : '-'}{' '}
              <span className="text-xs font-normal text-subtle">{t.units.perKm}</span>
            </p>
            <p className="text-caption text-subtle">{s.recoveryPace}</p>
          </div>
        </div>
        <p className="mt-3 text-caption text-subtle">
          {verdict === 'repsBuilt'
            ? s.reading.repsBuilt(
                set.reps.length,
                formatClock(set.reps[0]!.paceSecPerKm ?? 0),
                formatClock(set.reps[set.reps.length - 1]!.paceSecPerKm ?? 0),
                driftClause(set.hrDriftBpm),
              )
            : verdict === 'repsHeldRecoveriesSlowed' && set.firstRecoverySecPerKm && set.lastRecoverySecPerKm
              ? s.reading.repsHeldRecoveriesSlowed(
                  set.inBand,
                  set.reps.length,
                  formatClock(set.firstRecoverySecPerKm),
                  formatClock(set.lastRecoverySecPerKm),
                )
              : verdict === 'repsHeld'
                ? s.reading.repsHeld(set.inBand, set.reps.length, driftClause(set.hrDriftBpm))
                : s.reading.repsFaded(set.inBand, set.reps.length, set.spreadSecPerKm ?? 0)}
        </p>
      </GlassSurface>
    </>
  )
}
