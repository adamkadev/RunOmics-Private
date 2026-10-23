'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { Maximize2 } from 'lucide-react'
import { ActivityMapClient } from './ActivityMapClient'
import { NoRouteMap } from './ActivityMap'
import { Glass, GLASS_GROUP_BUTTON } from '@/components/ui/GlassSurface'
import { t } from '@/i18n'

/**
 * Fades in from the solid page ground over 96 pt, so full-strength tiles never
 * meet the edge sampler in a hard line under the status bar.
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
      // Marks the canvas and its glass controls while the map moves.
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
