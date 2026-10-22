'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { Maximize2 } from 'lucide-react'
import { ActivityMapClient } from './ActivityMapClient'
import { NoRouteMap } from './ActivityMap'
import { Glass, GLASS_GROUP_BUTTON } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

/**
 * The hero's top meets the edge sampler, the status bar above it the page's
 * own colour: it fades in from the solid page ground over 96 pt, eased
 * (F15). The light 35 % wash Liquid Glass v3 left let full-strength tiles
 * meet the sampler's foot, a hard line 12 pt under the status bar. The foot
 * fades into the page over 64 pt (Liquid Glass v3, §7.2).
 */
const TOP_FADE = {
  background:
    'linear-gradient(var(--background), color-mix(in srgb, var(--background) 84%, transparent) 25%, color-mix(in srgb, var(--background) 50%, transparent) 50%, color-mix(in srgb, var(--background) 16%, transparent) 75%, transparent)',
}

export function HeroFades() {
  return (
    <>
      <div aria-hidden data-testid="hero-top-fade" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24" style={TOP_FADE} />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-background to-transparent" />
    </>
  )
}

const FADES = <HeroFades />

/**
 * The activity's map hero (3.0): edge to edge, 330 pt (3.0's height, back from
 * Liquid Glass v3's 300 at the owner's ask, round 2), fading into the page
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
      // The canvas and its glass controls: marked while the map moves (README §6.12.2).
      data-map-root
      className="relative -mx-4 h-[330px] overflow-hidden sm:-mx-6 lg:mx-0 lg:rounded-[24px]"
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
