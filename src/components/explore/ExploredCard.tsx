'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ExploreAreaRef } from '@/domain/explore/types'
import { cardClass } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { getExploreEngine, type ExploreEngine } from './exploreEngine'
import { districtsHref } from './exploreHref'
import {
  MAX_SEGMENTS,
  exploredCacheKey,
  exploredSummary,
  isComplete,
  parseExploredSummary,
  readExploredCache,
  writeExploredCache,
  type ExploredSummary,
} from './exploredSummary'
import type { ClusterTrackRef } from './workerProtocol'

export interface ExploredCardProps {
  /** The home cluster's area (`getExploreHome`). */
  area: ExploreAreaRef
  clusterId: string
  /** The cluster's runs: the worker fetches their tracks itself. */
  runs: readonly ClusterTrackRef[]
  /** Changes when the set of runs does: half of the cache key. */
  dataVersion: string
  /** Tests hand in a fake engine. */
  engineFor?: () => ExploreEngine
}

// The same press as ProgressHub's LINK_CARD.
const LINK_CARD = 'text-left transition-transform duration-100 ease-out active:scale-[0.98]'
const PARTIAL_FILL = 'color-mix(in srgb, var(--accent) 60%, transparent)'

/** By cache key, so a second mount meanwhile (Strict Mode, a quick return to the page) waits for the same answer. */
const inflight = new Map<string, Promise<ExploredSummary>>()

function summarise(
  engine: ExploreEngine,
  { area, clusterId, runs }: Pick<ExploredCardProps, 'area' | 'clusterId' | 'runs'>,
  key: string,
): Promise<ExploredSummary> {
  const running = inflight.get(key)
  if (running) return running
  const work = (async () => {
    await engine.loadArea(area)
    await engine.fetchClusterTracks(area, clusterId, runs)
    // No home is sent: the worker takes the runs' median start, and only the summary, no coordinate, is kept.
    // This cluster's runs alone: the map may have added another cluster's to the same area in this session.
    const coverage = await engine.coverage(area, { activityIds: runs.map((run) => run.id), home: null, homeFromTracks: true })
    const summary = exploredSummary(coverage)
    writeExploredCache(key, summary)
    return summary
  })()
  inflight.set(key, work)
  void work.then(
    () => inflight.delete(key),
    () => inflight.delete(key),
  )
  return work
}

const subscribeNothing = () => () => {}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** The server and the first client render have no storage, so both draw the skeleton and hydration matches. */
function useExploredSummary(props: ExploredCardProps): { summary: ExploredSummary | null; failed: boolean } {
  const { area, clusterId, runs, dataVersion, engineFor = getExploreEngine } = props
  const key = exploredCacheKey(area.version, dataVersion)
  const raw = useSyncExternalStore(subscribeNothing, () => readRaw(key), () => null)
  const cached = useMemo(() => (raw ? parseExploredSummary(safeParse(raw)) : null), [raw])
  const [computed, setComputed] = useState<{ key: string; summary: ExploredSummary | null } | null>(null)

  useEffect(() => {
    // Read again rather than trusted from the render: the hydration render
    // had no storage to read.
    if (readExploredCache(key)) return
    let cancelled = false
    summarise(engineFor(), { area, clusterId, runs }, key).then(
      (summary) => {
        if (!cancelled) setComputed({ key, summary })
      },
      (err: unknown) => {
        // Quietly: the card leaves the hub, nothing else depends on it.
        console.warn('Explored card: coverage failed', err)
        if (!cancelled) setComputed({ key, summary: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, area, clusterId, runs, engineFor])

  const settled = computed?.key === key ? computed : null
  return { summary: cached ?? settled?.summary ?? null, failed: !cached && settled !== null && settled.summary === null }
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function SegmentBar({ summary }: { summary: ExploredSummary | null }) {
  if (!summary || summary.segments.length > MAX_SEGMENTS) {
    return (
      <div className="relative h-2 overflow-hidden rounded-[4px] bg-[var(--track)]" aria-hidden="true" data-testid="explored-bar">
        {summary && <div className="absolute inset-y-0 left-0 rounded-[4px] bg-accent" style={{ width: `${summary.pct}%` }} />}
      </div>
    )
  }
  return (
    <div className="flex h-2 gap-1" aria-hidden="true" data-testid="explored-bar">
      {summary.segments.map((pct, i) => {
        // Complete reads whole, even at 96%.
        const complete = isComplete(pct)
        return (
          <span
            key={i}
            data-testid="explored-segment"
            data-complete={complete ? '' : undefined}
            className="relative min-w-0 flex-1 overflow-hidden rounded-[4px] bg-[var(--track)]"
          >
            <span
              className="absolute inset-y-0 left-0"
              style={{ width: `${complete ? 100 : pct}%`, background: complete ? 'var(--accent)' : PARTIAL_FILL }}
            />
          </span>
        )
      })}
    </div>
  )
}

/** Two sibling links, never one inside the other; the skeleton has the same rows, so the height is fixed from the first paint. */
export function ExploredCard(props: ExploredCardProps) {
  const h = t.profile.hub
  const { summary, failed } = useExploredSummary(props)
  if (failed) return null

  const next = summary?.next ?? null
  const nextParts = next ? h.exploredNext(next.name, formatPercent(next.pct)) : null

  return (
    <section className={cardClass({ className: 'flex flex-col gap-3' })} data-testid="explored-card" aria-busy={summary ? undefined : true}>
      <Link href={districtsHref()} prefetch={false} className={cn('flex flex-col gap-3', LINK_CARD)} data-testid="explored-open">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-headline text-foreground">{h.explored}</span>
          <span className="min-w-0 truncate text-sm text-muted-foreground">{props.area.name}</span>
        </div>
        {summary ? (
          <p className="flex h-12 min-w-0 items-baseline gap-2.5">
            <span className="shrink-0 text-[44px] font-bold leading-[48px] tracking-[-0.02em] tabular-nums text-foreground" data-testid="explored-pct">
              {formatPercent(summary.pct)}
            </span>
            <span className="min-w-0 truncate text-[15px] text-muted-foreground" data-testid="explored-complete">
              {h.exploredComplete(summary.complete, summary.total)}
            </span>
          </p>
        ) : (
          <div className="flex h-12 items-center" data-testid="explored-skeleton">
            <Skeleton className="h-10 w-44" />
          </div>
        )}
        <SegmentBar summary={summary} />
      </Link>
      {summary ? (
        <Link
          href={districtsHref(next?.id)}
          prefetch={false}
          className={cn('flex items-center justify-between gap-3 border-t border-border pt-2.5 text-[15px] leading-[22px]', LINK_CARD)}
          data-testid="explored-next"
        >
          <span className="min-w-0 truncate text-muted-foreground">
            {nextParts ? (
              <>
                {nextParts.lead}
                <b className="font-semibold text-foreground">{nextParts.name}</b>
                {nextParts.tail}
              </>
            ) : (
              h.exploredAllComplete(summary.total)
            )}
          </span>
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </Link>
      ) : (
        <div className="flex items-center border-t border-border pt-2.5" aria-hidden="true">
          <Skeleton className="h-[22px] w-40" />
        </div>
      )}
    </section>
  )
}
