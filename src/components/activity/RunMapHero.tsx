'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { Maximize2 } from 'lucide-react'
import { ActivityMapClient } from './ActivityMapClient'
import { NoRouteMap } from './ActivityMap'
import { Glass, GLASS_GROUP_BUTTON } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

/**
 * The fade at the hero's foot into the page, 64 pt (Liquid Glass v3, §7.2).
 * The top needs none: the controls over it are clear glass, legible on any
 * tile, and a light top wash only keeps the street labels off them.
 */
export function HeroFades() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-background/35 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-background to-transparent" />
    </>
  )
}

const FADES = <HeroFades />

/**
 * The activity's map hero (3.0): edge to edge, 300 pt (Liquid Glass v3), fading into the page
 * at the top and bottom, with the way back on the left as a 44 pt clear-glass
 * circle and expand and share on the right grouped in one clear-glass
 * capsule (Liquid Glass v3). The route is the run's one colour,
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
      className="relative -mx-4 h-[300px] overflow-hidden sm:-mx-6 lg:mx-0 lg:rounded-[24px]"
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
        {/* Expand and share grouped in one clear-glass capsule (G13). */}
        <Glass material="clear" className="flex h-11">
          {route && (
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              aria-label={t.activity.map.fullscreen}
              className={GLASS_GROUP_BUTTON}
            >
              <Maximize2 size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
          <Fragment key="share">{share}</Fragment>
        </Glass>
      </div>
    </section>
  )
}
