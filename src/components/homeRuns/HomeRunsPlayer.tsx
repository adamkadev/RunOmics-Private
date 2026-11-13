'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Clapperboard, Download, Pause, Play, RotateCcw } from 'lucide-react'
import type { HomeRun, HomeRunSpot } from '@/application/usecases/GetHomeRuns'
import { Button } from '@/components/ui/Button'
import { SEGMENTED_FILL_SEGMENT_CLASS, SEGMENTED_IDLE_CLASS, SEGMENTED_THUMB_CLASS, SEGMENTED_TRACK_CLASS } from '@/components/ui/SegmentedTabs'
import { canvasVideoEncoder, encodeCanvasClip, videoExtension, type VideoEncoderKind } from '@/lib/canvasVideo'
import { heatAccent } from '@/lib/heatRamp'
import { buildReplayScene, drawReplay, REPLAY_CUES, REPLAY_FPS, REPLAY_FRAMES, REPLAY_HEIGHT, REPLAY_WIDTH, replaySeconds, type ReplayScene } from '@/lib/homeRunsDraw'
import { pageFonts } from '@/lib/shareCard'
import { shareOrSaveFile } from '@/lib/shareCardExport'
import { formatDate, formatPercent } from '@/lib/formatters'
import { useAccent } from '@/lib/useAccent'
import { useUrlParam } from '@/lib/useUrlParam'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'

/** Holds a long replay's detail at 1080 × 1920. */
const BITRATE = 8_000_000

type Period = 'all' | 'year' | 'month'

interface PeriodTab {
  id: Period
  label: string
  runs: HomeRun[]
}

/** All, this year and this month, each only when it holds runs the wider one does not. */
export function homeRunPeriods(runs: HomeRun[], today: string): PeriodTab[] {
  const capital = (text: string) => text.charAt(0).toLocaleUpperCase(t.locale) + text.slice(1)
  const year = runs.filter((run) => run.date.startsWith(today.slice(0, 4)))
  const month = year.filter((run) => run.date.startsWith(today.slice(0, 7)))
  const tabs: PeriodTab[] = [{ id: 'all', label: t.homeRuns.periodAll, runs }]
  if (year.length > 0 && year.length < runs.length) tabs.push({ id: 'year', label: today.slice(0, 4), runs: year })
  if (month.length > 0 && month.length < tabs.at(-1)!.runs.length) {
    tabs.push({ id: 'month', label: capital(formatDate(today, { precision: 'month', year: 'never' })), runs: month })
  }
  return tabs.length > 1 ? tabs : []
}

/** The start point a link or the switcher picked (`?start=2`), the busiest one by default. */
export function useHomeRunSpot(spots: readonly HomeRunSpot[]): [number, (index: number) => void] {
  const [param, setParam] = useUrlParam('start')
  const picked = Number(param) - 1
  const index = Number.isInteger(picked) && picked > 0 && picked < spots.length ? picked : 0
  return [index, (next) => setParam(next === 0 ? null : String(next + 1))]
}

/** The page's subtitle, for the start point shown. */
export function HomeRunsSubtitle({ spots }: { spots: HomeRunSpot[] }) {
  const [index] = useHomeRunSpot(spots)
  const spot = spots[index]
  if (!spot) return null
  return (
    <p className="text-sm text-muted-foreground" data-testid="home-runs-subtitle">
      {t.homeRuns.subtitle(spot.runs.length, formatDate(spot.firstDate, { precision: 'month', year: 'always' }))}
    </p>
  )
}

export function HomeRunsPlayer({ spots, today }: { spots: HomeRunSpot[]; today: string }) {
  const accentId = useAccent()
  const [spotIdx, setSpotIdx] = useHomeRunSpot(spots)
  const spot = spots[spotIdx]!
  const periods = useMemo(() => homeRunPeriods(spot.runs, today), [spot, today])
  const [period, setPeriod] = useState<Period>('all')
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [encoder, setEncoder] = useState<VideoEncoderKind | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [video, setVideo] = useState<{ scene: ReplayScene; file: File } | null>(null)
  const [failed, setFailed] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const runs = periods.find((tab) => tab.id === period)?.runs ?? spot.runs

  const scene = useMemo<ReplayScene>(() => buildReplayScene(runs, {
    accent: heatAccent(accentId),
    font: pageFonts().display,
    labels: {
      title: t.homeRuns.title,
      subtitle: t.homeRuns.subtitle(runs.length, formatDate(runs[0]!.date, { precision: 'month', year: 'always' })),
      running: t.homeRuns.running,
      finished: t.homeRuns.finished,
      histogram: t.homeRuns.histogram,
      elapsed: t.homeRuns.elapsed,
    },
  }), [runs, accentId])

  useEffect(() => {
    void canvasVideoEncoder(REPLAY_WIDTH, REPLAY_HEIGHT, BITRATE).then(setEncoder)
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setTime((prev) => {
        const next = prev + dt
        if (next >= REPLAY_CUES.end) {
          setPlaying(false)
          return REPLAY_CUES.end
        }
        return next
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, Math.round(rect.width * dpr))
    const h = Math.max(1, Math.round(rect.height * dpr))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    const ctx = canvas.getContext('2d')
    if (ctx) drawReplay(ctx, scene, replaySeconds(time, scene.maxSeconds), w, h, 'page')
  }, [scene, time])

  const restart = () => {
    setTime(0)
    setPlaying(true)
  }

  const videoFile = video?.scene === scene ? video.file : null

  // Encoding outlasts the few seconds a tap lets a page open the share sheet: the file is shared on a second tap.
  const makeVideo = async () => {
    if (!encoder || progress !== null) return
    const controller = new AbortController()
    abortRef.current = controller
    setFailed(false)
    setProgress(0)
    try {
      const blob = await encodeCanvasClip({
        width: REPLAY_WIDTH,
        height: REPLAY_HEIGHT,
        frames: REPLAY_FRAMES,
        fps: REPLAY_FPS,
        bitrate: BITRATE,
        draw: (canvas, f) => {
          const ctx = canvas.getContext('2d')
          if (ctx) drawReplay(ctx, scene, replaySeconds(f / REPLAY_FPS, scene.maxSeconds), canvas.width, canvas.height)
        },
      }, encoder, setProgress, controller.signal)
      setVideo({ scene, file: new File([blob], `runomics-home-runs.${videoExtension(blob.type)}`, { type: blob.type }) })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error(err)
        setFailed(true)
      }
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3.5">
      {periods.length > 0 && (
        <div className={cn(SEGMENTED_TRACK_CLASS, 'w-full max-w-[420px]')} role="group" aria-label={t.homeRuns.periods} data-testid="home-runs-periods">
          {periods.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={tab.id === period}
              className={cn('h-[30px] whitespace-nowrap px-3 text-[13px] tabular-nums', SEGMENTED_FILL_SEGMENT_CLASS, tab.id === period ? SEGMENTED_THUMB_CLASS : SEGMENTED_IDLE_CLASS)}
              onClick={() => {
                setPeriod(tab.id)
                restart()
              }}
            >
              {t.homeRuns.period(tab.label, tab.runs.length)}
            </button>
          ))}
        </div>
      )}
      {/* Up to three start points; the periods above are the one shown. */}
      {spots.length > 1 && (
        <div className={SEGMENTED_TRACK_CLASS} role="group" aria-label={t.homeRuns.spots} data-testid="home-runs-spots">
          {spots.map((s, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={i === spotIdx}
              className={cn('h-[26px] whitespace-nowrap px-3 text-[13px] tabular-nums', i === spotIdx ? SEGMENTED_THUMB_CLASS : SEGMENTED_IDLE_CLASS)}
              onClick={() => {
                setSpotIdx(i)
                setPeriod('all')
                restart()
              }}
            >
              {t.homeRuns.spot(s.runs.length)}
            </button>
          ))}
        </div>
      )}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={t.homeRuns.canvasLabel(runs.length)}
        data-testid="home-runs-canvas"
        className="aspect-[9/16] w-full max-w-[420px] rounded-[24px] bg-[#0a0c10]"
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" onClick={() => (time >= REPLAY_CUES.end ? restart() : setPlaying((p) => !p))} data-testid="home-runs-play">
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {playing ? t.homeRuns.pause : t.homeRuns.play}
        </Button>
        <Button variant="secondary" onClick={restart} data-testid="home-runs-restart">
          <RotateCcw size={16} aria-hidden="true" />
          {t.homeRuns.restart}
        </Button>
        {encoder && (videoFile ? (
          <Button onClick={() => void shareOrSaveFile(videoFile, t.homeRuns.title)} data-testid="home-runs-save">
            <Download size={16} aria-hidden="true" />
            {t.homeRuns.saveVideo}
          </Button>
        ) : (
          <Button onClick={() => void makeVideo()} disabled={progress !== null} data-testid="home-runs-export">
            <Clapperboard size={16} aria-hidden="true" />
            {progress === null ? t.homeRuns.makeVideo : t.homeRuns.making(formatPercent(progress * 100))}
          </Button>
        ))}
      </div>
      {failed && <p className="text-footnote text-muted-foreground" role="status" data-testid="home-runs-failed">{t.homeRuns.videoFailed}</p>}
    </div>
  )
}
