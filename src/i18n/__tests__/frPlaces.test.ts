import { describe, expect, it } from 'vitest'
import { aLieu, fr } from '../fr'

// French puts « à » before a place, and the article of a commune's name
// contracts with it: « au Ban-Saint-Martin », never « à Le Ban-Saint-Martin ».
describe('aLieu', () => {
  it('contracts à + le and à + les, and leaves la, l’ and a bare name alone', () => {
    expect(aLieu('Le Ban-Saint-Martin')).toBe('au Ban-Saint-Martin')
    expect(aLieu('Les Arènes')).toBe('aux Arènes')
    expect(aLieu('La Maxe')).toBe('à La Maxe')
    expect(aLieu('L’Île-Saint-Denis')).toBe('à L’Île-Saint-Denis')
    expect(aLieu('Longeville-lès-Metz')).toBe('à Longeville-lès-Metz')
    expect(aLieu('Lessy')).toBe('à Lessy')
  })

  it('names a commune right in the generator’s title, its GPX and the Plan a run button', () => {
    expect(fr.pages.map.explore.title('Le Ban-Saint-Martin')).toBe('Courir au Ban-Saint-Martin')
    expect(fr.pages.map.explore.gpxDescription('Le Ban-Saint-Martin')).toBe('Une boucle au Ban-Saint-Martin, prévue avec RunOmics.')
    expect(fr.pages.map.districts.planRunIn('Les Arènes')).toBe('Prévoir une sortie aux Arènes')
    expect(fr.pages.map.explore.title('Nouvelle Ville')).toBe('Courir à Nouvelle Ville')
  })
})
