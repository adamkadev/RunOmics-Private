'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { t } from '@/i18n'
import { GlassLayers, glassClass } from '@/components/ui/GlassSurface'
import { cn } from '@/lib/utils'

const CREDIT_LINKS: Record<string, string> = {
  MapTiler: 'https://www.maptiler.com/copyright/',
  OpenStreetMap: 'https://www.openstreetmap.org/copyright',
  // Explore's generated loops, credited wherever one is drawn.
  openrouteservice: 'https://openrouteservice.org/terms-of-service/',
}

export interface MapCredit {
  text: string
  href?: string
}

function Credit({ text, href }: MapCredit) {
  const name = href ? null : Object.keys(CREDIT_LINKS).find((n) => text.includes(n))
  const link = href ?? (name ? CREDIT_LINKS[name] : undefined)
  if (!link) return <span className="whitespace-nowrap">{text}</span>
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap underline-offset-2 hover:underline">
      {text}
    </a>
  )
}

export function MapAttribution({ className, extraCredits }: { className?: string; extraCredits?: readonly MapCredit[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const credits: readonly MapCredit[] = [...t.pages.map.attribution.split(' · ').map((text): MapCredit => ({ text })), ...(extraCredits ?? [])]

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('pointer-events-auto relative', className)} data-testid="map-attribution">
      {open && (
        <p
          role="note"
          className="absolute bottom-full right-0 mb-1.5 rounded-[12px] bg-[var(--raised)] px-2.5 py-1.5 text-right text-caption leading-snug text-muted-foreground shadow-[var(--shadow-raised)]"
        >
          {/* The separator stays inside its credit's nowrap span, so a line breaks after a "·", never before. */}
          {credits.map((credit, i) => (
            <Fragment key={`${i}:${credit.text}`}>
              {i > 0 && ' '}
              <span className="whitespace-nowrap">
                <Credit {...credit} />
                {i < credits.length - 1 && ' ·'}
              </span>
            </Fragment>
          ))}
        </p>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t.pages.map.credits}
        className={glassClass('clear', 'hit-44 flex size-7 items-center justify-center text-foreground')}
      >
        <GlassLayers />
        <Info size={15} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
