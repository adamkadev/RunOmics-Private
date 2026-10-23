/**
 * A glass object (`.lg`) is never faded itself: opacity under 1 makes it a
 * backdrop root and WebKit then blurs nothing behind it, so its children take
 * the opacity instead.
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

export function unfadeElement(el: HTMLElement) {
  fadeElement(el, 1)
  el.style.removeProperty('pointer-events')
  el.style.removeProperty('transition')
  if (el.classList.contains('lg')) {
    for (const child of el.children) if (child instanceof HTMLElement) child.style.removeProperty('transition')
  }
}
