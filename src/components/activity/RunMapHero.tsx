'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { Maximize2 } from 'lucide-react'
import { ActivityMapClient } from './ActivityMapClient'
import { NoRouteMap } from './ActivityMap'
import { t } from '@/i18n'

/** Top and bottom fades into the page, so the buttons and the title read over any tile. */
export function HeroFades() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-background/80 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-background to-transparent" />
    </>
  )
}

const FADES = <HeroFades />

/**
 * The activity's map hero (3.0): edge to edge, 330 pt, fading into the page
 * at the top and bottom, with the way back on the left and expand and share
 * on the right as 40 pt round buttons. The route is the run's one colour,
 * with no km markers and no pace or heart-rate ramp. Expand opens the map
 * full screen, with `card` floating at its foot.
 */
export function RunMapHero({
  route,
  back,
  share,
  card,
}: {
  route: [number, number][] | null
  back?: ReactNode
  share?: ReactNode
  card?: ReactNode
}) {
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <section
      data-testid="run-hero"
      className="relative -mx-4 h-[330px] overflow-hidden sm:-mx-6 lg:mx-0 lg:rounded-3xl lg:border lg:border-border"
    >
      {route ? (
        <ActivityMapClient
          route={route}
          className="h-full min-h-0 w-full rounded-none"
          fullscreen={fullscreen}
          onFullscreenChange={setFullscreen}
          overlay={FADES}
          card={card}
        />
      ) : (
        <>
          <NoRouteMap className="h-full min-h-0 w-full rounded-none border-0" />
          {FADES}
        </>
      )}
      <div className="absolute inset-x-0 top-3 z-20 flex items-start justify-between px-4">
        {/* Keyed: back and share are elements the server page made, and React
            asks a key of one set beside other children of a client element. */}
        <Fragment key="back">{back ?? <span />}</Fragment>
        <div className="flex gap-2">
          {route && (
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              aria-label={t.activity.map.fullscreen}
              className="map-round-button hit-44"
            >
              <Maximize2 size={17} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
          <Fragment key="share">{share}</Fragment>
        </div>
      </div>
    </section>
  )
}
