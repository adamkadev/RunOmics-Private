import { describe, expect, it } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { areaFile, at, rect, testArea, unit } from '@/domain/explore/__tests__/areaFixture'
import {
  ABOVE_SHEET,
  QUARTIER_EASE_MS,
  QUARTIER_MAX_ZOOM,
  QUARTIER_SIDE,
  QUARTIER_TOP,
  easeToUnit,
  quartierPadding,
  sheetBoxOf,
  unitBounds,
} from '../quartierCamera'
import { FakeMap } from './fakeMap'

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9

describe('unitBounds', () => {
  it('boxes one unit’s polygon', () => {
    const box = unitBounds(testArea(), 'test-bravo')!
    const [minLon, minLat] = at(600, 0)
    const [maxLon, maxLat] = at(1200, 150)
    expect(close(box.minLon, minLon) && close(box.minLat, minLat) && close(box.maxLon, maxLon) && close(box.maxLat, maxLat)).toBe(true)
  })

  it('boxes every part of a multipolygon', () => {
    const a = rect(0, 0, 100, 100)
    const b = rect(500, 300, 700, 400)
    const area = areaFile([unit('test-multi', 'Multi', { type: 'MultiPolygon', coordinates: [a.coordinates, b.coordinates] }, [1])])
    const box = unitBounds(area, 'test-multi')!
    expect(close(box.minLon, at(0, 0)[0]) && close(box.maxLon, at(700, 0)[0])).toBe(true)
    expect(close(box.minLat, at(0, 0)[1]) && close(box.maxLat, at(0, 400)[1])).toBe(true)
  })

  it('is null for an id the area doesn’t hold, or no area yet', () => {
    expect(unitBounds(testArea(), 'test-zulu')).toBeNull()
    expect(unitBounds(null, 'test-bravo')).toBeNull()
  })
})

describe('quartierPadding', () => {
  it('fullscreen: keeps the quartier above the sheet and below the top row', () => {
    // The map fills an 852 pt screen; the sheet starts at 470.
    expect(quartierPadding({ mapTop: 0, mapBottom: 852, sheetTop: 470 })).toEqual({
      top: QUARTIER_TOP,
      right: QUARTIER_SIDE,
      bottom: 852 - 470 + ABOVE_SHEET,
      left: QUARTIER_SIDE,
    })
  })

  it('the map card, clear of the sheet: no room taken at the foot but the margin', () => {
    expect(quartierPadding({ mapTop: 90, mapBottom: 450, sheetTop: 560 })).toEqual({
      top: QUARTIER_TOP,
      right: QUARTIER_SIDE,
      bottom: ABOVE_SHEET,
      left: QUARTIER_SIDE,
    })
  })

  it('the map card, partly under the sheet: only the overlap', () => {
    expect(quartierPadding({ mapTop: 200, mapBottom: 560, sheetTop: 500 })?.bottom).toBe(60 + ABOVE_SHEET)
  })

  it('a map scrolled partly off the top keeps the quartier in the part on screen', () => {
    expect(quartierPadding({ mapTop: -150, mapBottom: 210, sheetTop: 600 })?.top).toBe(150 + ABOVE_SHEET)
  })

  it('gives the top way first, then leaves the camera be when there is no room', () => {
    // 360 pt of map, 280 of it under the sheet: the top row's margin shrinks.
    const tight = quartierPadding({ mapTop: 0, mapBottom: 360, sheetTop: 80 })!
    expect(tight.bottom).toBe(280 + ABOVE_SHEET)
    expect(tight.top).toBeLessThan(QUARTIER_TOP)
    expect(360 - tight.top - tight.bottom).toBeGreaterThanOrEqual(48)
    // All of it under the sheet.
    expect(quartierPadding({ mapTop: 0, mapBottom: 360, sheetTop: 0 })).toBeNull()
  })

  it('a phone’s bottom sheet, measured all round: still the room above it', () => {
    // 393 x 852 fullscreen; the medium sheet 8 pt in from the sides and foot.
    const frame = { mapTop: 0, mapBottom: 852, mapLeft: 0, mapRight: 393, sheetTop: 470, sheetBottom: 844, sheetLeft: 8, sheetRight: 385 }
    expect(quartierPadding(frame)).toEqual(quartierPadding({ mapTop: 0, mapBottom: 852, sheetTop: 470 }))
  })

  it('the centred sheet of a wide screen: the side with the most room, not a strip over it', () => {
    // A 1280 x 800 window: the map card at y 170-730, x 140-1140; the 384 pt
    // sheet centred at y 250-550, x 448-832. Read as a bottom sheet, the
    // quartier got a 48 pt band under the filter row.
    const frame = { mapTop: 170, mapBottom: 730, mapLeft: 140, mapRight: 1140, sheetTop: 250, sheetBottom: 550, sheetLeft: 448, sheetRight: 832 }
    expect(quartierPadding(frame)).toEqual({ top: QUARTIER_TOP, right: 1140 - 448 + ABOVE_SHEET, bottom: ABOVE_SHEET, left: QUARTIER_SIDE })
  })

  it('the centred sheet over a wide, short map: the strip under it when that is roomier', () => {
    // A 1600 pt map, 600 tall; a sheet 380 wide in its middle, ending 360 pt up.
    const frame = { mapTop: 0, mapBottom: 600, mapLeft: 0, mapRight: 1600, sheetTop: 20, sheetBottom: 240, sheetLeft: 610, sheetRight: 990 }
    const padding = quartierPadding(frame)!
    // Under it: 600 - 256 - 16 = 328 tall; beside it: 610 - 24 - 16 = 570 wide, 512 tall.
    expect(padding).toEqual({ top: QUARTIER_TOP, right: 1600 - 610 + ABOVE_SHEET, bottom: ABOVE_SHEET, left: QUARTIER_SIDE })
    // Narrower sides: the strip under the sheet wins.
    const narrow = quartierPadding({ ...frame, mapRight: 1000, sheetLeft: 310, sheetRight: 690 })!
    expect(narrow).toEqual({ top: 240 + ABOVE_SHEET, right: QUARTIER_SIDE, bottom: ABOVE_SHEET, left: QUARTIER_SIDE })
  })

  it('a landscape phone’s centred sheet: beside it, where a bottom sheet’s rule found no room at all', () => {
    // 852 x 393 fullscreen, the sheet centred and nearly the screen's height.
    const frame = { mapTop: 0, mapBottom: 393, mapLeft: 0, mapRight: 852, sheetTop: 16, sheetBottom: 377, sheetLeft: 234, sheetRight: 618 }
    expect(quartierPadding({ mapTop: 0, mapBottom: 393, sheetTop: 16 })).toBeNull()
    expect(quartierPadding(frame)).toEqual({ top: QUARTIER_TOP, right: 852 - 234 + ABOVE_SHEET, bottom: ABOVE_SHEET, left: QUARTIER_SIDE })
  })
})

describe('sheetBoxOf', () => {
  const layer = { getBoundingClientRect: () => ({ top: 47, left: 0 }) }
  it('reads the panel’s place in its dialog layer, not its moving box', () => {
    // Mid-rise, the panel's own box is lower down: it isn't read.
    const panel = {
      offsetTop: 420,
      offsetLeft: 8,
      offsetHeight: 377,
      offsetWidth: 377,
      parentElement: layer,
      getBoundingClientRect: () => ({ top: 800 }),
    } as unknown as HTMLElement
    expect(sheetBoxOf(panel)).toEqual({ top: 467, bottom: 844, left: 8, right: 385 })
  })

  it('is null without a panel, or one not laid out yet', () => {
    expect(sheetBoxOf(null)).toBeNull()
    const unlaid = { offsetTop: 0, offsetLeft: 0, offsetHeight: 0, offsetWidth: 0, parentElement: layer } as unknown as HTMLElement
    expect(sheetBoxOf(unlaid)).toBeNull()
  })
})

describe('easeToUnit', () => {
  const BOX = { minLon: -150, minLat: 45, maxLon: -149.99, maxLat: 45.01 }
  const PADDING = { top: 72, right: 24, bottom: 400, left: 24 }

  it('asks the map for the frame, then eases to its centre and zoom - no padding left on the map', () => {
    const map = new FakeMap()
    expect(easeToUnit(map as unknown as MapLibreMap, BOX, PADDING)).toBe(true)
    expect(map.cameraQueries).toEqual([
      {
        bounds: [
          [-150, 45],
          [-149.99, 45.01],
        ],
        options: { padding: PADDING, maxZoom: QUARTIER_MAX_ZOOM },
      },
    ])
    expect(map.eases).toEqual([{ center: [1, 2], zoom: 14, duration: QUARTIER_EASE_MS }])
    expect(map.eases[0]).not.toHaveProperty('padding')
  })

  it('jumps without motion when motion is reduced', () => {
    const map = new FakeMap()
    easeToUnit(map as unknown as MapLibreMap, BOX, PADDING, true)
    expect(map.eases[0]?.duration).toBe(0)
  })

  it('stays put when the map can’t frame the box', () => {
    const map = new FakeMap()
    map.camera = undefined
    expect(easeToUnit(map as unknown as MapLibreMap, BOX, PADDING)).toBe(false)
    expect(map.eases).toEqual([])
  })
})
