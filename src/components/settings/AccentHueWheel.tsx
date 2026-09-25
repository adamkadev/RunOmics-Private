'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import {
  HUE_STEP,
  HUE_STOPS,
  accentSwatchColor,
  isReservedHue,
  snapHue,
} from '@/lib/accent'

const DIAL = 184
const STOP = 22
const RING_INSET = 18
const RESERVED_TRACK = 'rgba(148,178,220,.14)'
const SELECTED_RING = 'var(--foreground)'
const DIAL_INK = '#101a2c'

function stopPosition(hue: number): { left: number; top: number } {
  // -90 so hue 0 sits at the top of the dial rather than at three o'clock.
  const radians = ((hue - 90) * Math.PI) / 180
  const radius = DIAL / 2 - RING_INSET - STOP / 2
  return {
    left: DIAL / 2 + Math.cos(radians) * radius - STOP / 2,
    top: DIAL / 2 + Math.sin(radians) * radius - STOP / 2,
  }
}

const HOLE_RADIUS = DIAL / 2 - RING_INSET - STOP

function offsetFromCentre(
  event: { clientX: number; clientY: number },
  dial: HTMLElement,
): { hue: number; radius: number } {
  const box = dial.getBoundingClientRect()
  const x = event.clientX - (box.left + box.width / 2)
  const y = event.clientY - (box.top + box.height / 2)
  return {
    hue: ((((Math.atan2(y, x) * 180) / Math.PI + 90) % 360) + 360) % 360,
    radius: Math.hypot(x, y),
  }
}

/**
 * An angle only means a hue out on the ring. Inside the hole there is no hue to
 * read, and a pointer the dial has captured can be anywhere on the page - the
 * swatch row above it, for one - so both have to miss rather than pick.
 */
function onRing(radius: number): boolean {
  return radius >= HOLE_RADIUS && radius <= DIAL / 2
}

interface Props {
  hue: number
  onPick: (hue: number) => void
}

export function AccentHueWheel({ hue, onPick }: Props) {
  const dialRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [reservedHit, setReservedHit] = useState(false)

  function pick(raw: number) {
    // Inside the band the wheel does not stop - it carries on to the nearest
    // hue the app has not already spent, and says why it moved.
    const reserved = isReservedHue(raw)
    setReservedHit(reserved)
    const next = snapHue(raw, hue)
    if (next !== hue) onPick(next)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dialRef.current) return
    const { hue: raw, radius } = offsetFromCentre(event, dialRef.current)
    if (!onRing(radius)) return
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    pick(raw)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current || !dialRef.current) return
    // Once a drag is under way the angle is enough - a finger that wanders off
    // the ring is still steering it.
    pick(offsetFromCentre(event, dialRef.current).hue)
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const index = HUE_STOPS.indexOf(hue)
    const from = index === -1 ? hue : HUE_STOPS[(index + step + HUE_STOPS.length) % HUE_STOPS.length]!
    pick(from)
  }

  // `from -7.5deg` puts hue 0's segment astride twelve o'clock, so each stop's
  // colour sits under the dot that selects it.
  const track = HUE_STOPS.map((stop) => {
    const color = isReservedHue(stop) ? RESERVED_TRACK : accentSwatchColor({ kind: 'custom', hue: stop })
    return `${color} ${stop}deg ${stop + HUE_STEP}deg`
  }).join(', ')

  return (
    <div className="mt-4 flex flex-col items-center">
      <div
        ref={dialRef}
        role="radiogroup"
        aria-label={t.settings.accent.custom.open}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative touch-none rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-accent"
        style={{
          width: DIAL,
          height: DIAL,
          background: `conic-gradient(from ${-HUE_STEP / 2}deg, ${track})`,
          maskImage: `radial-gradient(circle, transparent 0 ${HOLE_RADIUS}px, #000 ${HOLE_RADIUS + 1}px)`,
          WebkitMaskImage: `radial-gradient(circle, transparent 0 ${HOLE_RADIUS}px, #000 ${HOLE_RADIUS + 1}px)`,
        }}
      >
        {HUE_STOPS.map((stop) => {
          const reserved = isReservedHue(stop)
          const selected = stop === hue
          const { left, top } = stopPosition(stop)
          return (
            <button
              key={stop}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={reserved}
              aria-label={reserved ? t.settings.accent.custom.reserved : t.settings.accent.custom.stop(stop)}
              tabIndex={-1}
              onClick={() => pick(stop)}
              className={cn(
                'absolute flex items-center justify-center rounded-full transition-transform',
                !reserved && 'active:scale-90',
              )}
              style={{
                left,
                top,
                width: STOP,
                height: STOP,
                background: reserved ? RESERVED_TRACK : accentSwatchColor({ kind: 'custom', hue: stop }),
                // A dot sits on its own colour, so it needs a rim to read as a
                // dot at all. The selected one swaps that rim for the ring the
                // curated swatches use.
                boxShadow: selected ? `0 0 0 2px ${SELECTED_RING}` : `0 0 0 2px ${DIAL_INK}`,
                cursor: reserved ? 'not-allowed' : 'pointer',
              }}
            >
              {selected && <Check size={12} className="text-white drop-shadow-[0_1px_1.5px_var(--scrim-strong)]" />}
            </button>
          )
        })}
      </div>

      {/* The explanation sits between the wheel and the commit, so it is read
          before Done rather than after it. It carries the standing rule until a
          blocked stop is hit, then says what just happened. */}
      <p className="mt-3 min-h-4 text-center text-xs leading-snug text-foreground" aria-live="polite">
        {reservedHit ? t.settings.accent.custom.reserved : null}
      </p>
    </div>
  )
}
