// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { keepAttributionCollapsed } from '../mapAttribution'

function attribution() {
  const mapEl = document.createElement('div')
  mapEl.innerHTML = '<details class="maplibregl-ctrl-attrib"><summary class="maplibregl-ctrl-attrib-button"></summary></details>'
  const attrib = mapEl.querySelector<HTMLElement>('.maplibregl-ctrl-attrib')!
  const button = mapEl.querySelector<HTMLElement>('.maplibregl-ctrl-attrib-button')!
  return { mapEl, attrib, button }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('keepAttributionCollapsed', () => {
  it('closes the attribution MapLibre opens late in the load', async () => {
    const { mapEl, attrib } = attribution()
    keepAttributionCollapsed(mapEl)
    attrib.classList.add('maplibregl-compact', 'maplibregl-compact-show')
    await flush()
    expect(attrib.classList.contains('maplibregl-compact-show')).toBe(false)
    expect(attrib.classList.contains('maplibregl-compact')).toBe(true)
  })

  it('lets a tap open it', async () => {
    const { mapEl, attrib, button } = attribution()
    keepAttributionCollapsed(mapEl)
    button.addEventListener('click', () => attrib.classList.add('maplibregl-compact-show'))
    button.click()
    await flush()
    expect(attrib.classList.contains('maplibregl-compact-show')).toBe(true)
  })

  it('stops watching once cleaned up', async () => {
    const { mapEl, attrib } = attribution()
    keepAttributionCollapsed(mapEl)()
    attrib.classList.add('maplibregl-compact-show')
    await flush()
    expect(attrib.classList.contains('maplibregl-compact-show')).toBe(true)
  })
})
