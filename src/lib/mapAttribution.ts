const SHOW = 'maplibregl-compact-show'

/**
 * Keep MapLibre's compact attribution closed to its ⓘ until it is tapped.
 * MapLibre opens it whenever it first gets text to show, which lands at any
 * point of the load (a source's attribution can arrive after the first idle),
 * so a single close on idle lost the race and left it over the route. Every
 * reopen is closed again until the ⓘ is tapped; from then on the tap rules.
 * Returns the cleanup.
 */
export function keepAttributionCollapsed(mapEl: HTMLElement): () => void {
  const attrib = mapEl.querySelector<HTMLElement>('.maplibregl-ctrl-attrib')
  if (!attrib) return () => {}
  let tapped = false
  const onTap = () => { tapped = true }
  const button = attrib.querySelector('.maplibregl-ctrl-attrib-button')
  button?.addEventListener('click', onTap)
  const collapse = () => { if (!tapped && attrib.classList.contains(SHOW)) attrib.classList.remove(SHOW) }
  const observer = new MutationObserver(collapse)
  observer.observe(attrib, { attributes: true, attributeFilter: ['class'] })
  collapse()
  return () => {
    observer.disconnect()
    button?.removeEventListener('click', onTap)
  }
}
