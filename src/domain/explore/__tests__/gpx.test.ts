import { describe, it, expect } from 'vitest'
import { buildGpx, escapeXml, gpxFileName } from '../gpx'

const GPX_NS = 'http://www.topografix.com/GPX/1/1'

function parse(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
  return doc
}

/** A 2 km circle of 120 points around a fictional mid-Pacific centre, with a hill. */
function loop(withEle = true): number[][] {
  return Array.from({ length: 120 }, (_, k) => {
    const a = (2 * Math.PI * k) / 120
    const point = [-150 + 0.0045 * Math.cos(a), 45 + 0.0032 * Math.sin(a)]
    return withEle ? [...point, 180 + 20 * Math.sin(a)] : point
  })
}

function trackPoints(doc: Document): Element[] {
  return Array.from(doc.getElementsByTagNameNS(GPX_NS, 'trkpt'))
}

describe('buildGpx', () => {
  it('writes valid GPX 1.1 with one running track', () => {
    const doc = parse(buildGpx({ name: 'Nouvelle Ville loop', time: '2026-10-22T07:30:00.000Z', points: loop() }))
    const root = doc.documentElement

    expect(root.localName).toBe('gpx')
    expect(root.namespaceURI).toBe(GPX_NS)
    expect(root.getAttribute('version')).toBe('1.1')
    expect(root.getAttribute('creator')).toBe('RunOmics')
    expect(doc.querySelector('metadata > name')?.textContent).toBe('Nouvelle Ville loop')
    expect(doc.querySelector('metadata > time')?.textContent).toBe('2026-10-22T07:30:00.000Z')
    expect(doc.querySelector('trk > name')?.textContent).toBe('Nouvelle Ville loop')
    expect(doc.querySelector('trk > type')?.textContent).toBe('running')
    expect(doc.getElementsByTagNameNS(GPX_NS, 'trkseg')).toHaveLength(1)
  })

  it('closes the loop, so the track ends where it starts', () => {
    const points = trackPoints(parse(buildGpx({ name: 'Loop', points: loop() })))
    const first = points[0]!
    const last = points[points.length - 1]!

    expect(points.length).toBeGreaterThan(50)
    expect(points).toHaveLength(121)
    expect(last.getAttribute('lat')).toBe(first.getAttribute('lat'))
    expect(last.getAttribute('lon')).toBe(first.getAttribute('lon'))
  })

  it('does not repeat an end that already matches the start', () => {
    const closed = [...loop(), loop()[0]!]

    expect(trackPoints(parse(buildGpx({ name: 'Loop', points: closed })))).toHaveLength(121)
  })

  it('writes lat and lon with 6 decimals and elevation with 1', () => {
    const doc = parse(buildGpx({ name: 'Loop', points: [[-150.1234567, 45.7654321, 201.26], [-150, 45, 199]] }))
    const [first] = trackPoints(doc)

    expect(first!.getAttribute('lat')).toBe('45.765432')
    expect(first!.getAttribute('lon')).toBe('-150.123457')
    expect(first!.getElementsByTagNameNS(GPX_NS, 'ele')[0]?.textContent).toBe('201.3')
  })

  it('leaves out elevation when the points have none', () => {
    const doc = parse(buildGpx({ name: 'Loop', points: loop(false) }))

    expect(doc.getElementsByTagNameNS(GPX_NS, 'ele')).toHaveLength(0)
  })

  it('escapes names and descriptions', () => {
    const name = `Rock & "Roll" <Saint-Jean> l'île`
    const xml = buildGpx({ name, description: 'a < b & c', points: loop() })
    const doc = parse(xml)

    expect(doc.querySelector('metadata > name')?.textContent).toBe(name)
    expect(doc.querySelector('trk > name')?.textContent).toBe(name)
    expect(doc.querySelector('metadata > desc')?.textContent).toBe('a < b & c')
    expect(xml).not.toContain('<Saint-Jean>')
  })

  it('drops characters XML cannot carry', () => {
    expect(escapeXml('a\u0001b\u000bc\td')).toBe('abc\td')
    parse(buildGpx({ name: 'bell\u0007', points: loop() }))
  })

  it('leaves out desc and time when not given', () => {
    const doc = parse(buildGpx({ name: 'Loop', points: loop() }))

    expect(doc.querySelector('metadata > desc')).toBeNull()
    expect(doc.querySelector('metadata > time')).toBeNull()
  })

  it('skips points that are not numbers and stays valid with none', () => {
    expect(trackPoints(parse(buildGpx({ name: 'Loop', points: [[Number.NaN, 1], [1, 2], [2, 3]] })))).toHaveLength(3)
    expect(trackPoints(parse(buildGpx({ name: 'Empty', points: [] })))).toHaveLength(0)
  })
})

describe('gpxFileName', () => {
  it.each([
    ['Nouvelle Ville', 8.4, 'RunOmics-NouvelleVille-8km.gpx'],
    ['Le Ban-Saint-Martin', 9.5, 'RunOmics-LeBanSaintMartin-10km.gpx'],
    ['Longeville-lès-Metz', 12, 'RunOmics-LongevilleLesMetz-12km.gpx'],
    ['Sainte-Thérèse', 5.2, 'RunOmics-SainteTherese-5km.gpx'],
    ["Plantières-Queuleu l'Île", 7, 'RunOmics-PlantieresQueuleuLIle-7km.gpx'],
    ['Cœur de ville', 6, 'RunOmics-CoeurDeVille-6km.gpx'],
    ['Metz 2', 3.49, 'RunOmics-Metz2-3km.gpx'],
  ])('%s, %s km → %s', (name, km, expected) => {
    expect(gpxFileName(name, km)).toBe(expected)
  })

  it('still names the file without a usable name', () => {
    expect(gpxFileName('—', 8)).toBe('RunOmics-8km.gpx')
  })
})
