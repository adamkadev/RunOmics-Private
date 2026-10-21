/**
 * An element faded to `opacity` as an inline style, and none at all once
 * fully shown; faded out, it takes no taps.
 *
 * A glass object (`.lg`) is never faded itself: an opacity under 1 on the
 * wrapper makes it a backdrop root, and WebKit then blurs nothing behind it
 * - the glass goes flat while it fades. Its children (the blur, edge and tint
 * layers and the content) take the opacity instead, with the wrapper's own
 * transition if it has one, and the wrapper's drop shadow goes once the glass
 * is mostly gone (Liquid Glass v3, README §4).
 */
export function fadeElement(el: HTMLElement, opacity: number) {
  const glass = el.classList.contains('lg')
  const targets = glass ? [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement) : [el]
  for (const target of targets) {
    if (glass && el.style.transition) target.style.transition = el.style.transition
    if (opacity >= 1) target.style.removeProperty('opacity')
    else target.style.opacity = String(Math.max(0, opacity))
  }
  if (glass) {
    if (opacity >= 0.5) el.style.removeProperty('box-shadow')
    else el.style.boxShadow = 'none'
  }
  if (opacity <= 0) el.style.pointerEvents = 'none'
  else el.style.removeProperty('pointer-events')
}

/** An element as the page drew it, whatever fadeElement did to it. */
export function unfadeElement(el: HTMLElement) {
  fadeElement(el, 1)
  el.style.removeProperty('pointer-events')
  el.style.removeProperty('transition')
  if (el.classList.contains('lg')) {
    for (const child of el.children) if (child instanceof HTMLElement) child.style.removeProperty('transition')
  }
}
