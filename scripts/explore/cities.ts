/**
 * Cities whose quartiers are not in OpenStreetMap but are published as open
 * data. The build tries OSM `admin_level=10` first, then this registry, then
 * IGN IRIS, then the commune itself (scripts/build-explore-areas.ts).
 *
 * Add a city here when its own boundaries read better than IRIS: IRIS are
 * census blocks of about 2 000 people (49 in Metz), too small to feel like
 * quartiers and named after streets as often as places.
 */

export interface CityWfsSource {
  /** INSEE code of the commune the quartiers tile. */
  insee: string
  /** `ExploreSource.id`, e.g. 'metz-wfs'. */
  sourceId: string
  /** Credit line shown with the map. */
  label: string
  licence: string
  /** The dataset page credited, not the WFS endpoint. */
  url: string
  /** data.gouv.fr dataset id: its `last_modified` dates the source. */
  dataGouvId?: string
  /** Used when data.gouv.fr cannot be reached. */
  fallbackVersion: string
  wfs: {
    url: string
    typeName: string
    /** CQL filter keeping this commune's quartiers only. */
    cqlFilter: string
    idField: string
    nameField: string
  }
  /**
   * The published names as people write them. Metz's layer drops capitals
   * and accents ("Les Iles", "Metz-centre"); the spellings here follow the
   * OSM place nodes for the same quartiers.
   */
  nameOverrides: Record<string, string>
}

export const CITY_SOURCES: readonly CityWfsSource[] = [
  {
    insee: '57463',
    sourceId: 'metz-wfs',
    label: 'Ville de Metz / Eurométropole de Metz – Quartiers',
    licence: 'Licence Ouverte 2.0',
    url: 'https://www.data.gouv.fr/datasets/quartiers-eurometropole-de-metz',
    dataGouvId: '68f037ba25cbe799b197a563',
    fallbackVersion: '2026-03-24',
    wfs: {
      url: 'https://maps.eurometropolemetz.eu/wfs',
      typeName: 'public:fdp_adm_quar',
      cqlFilter: "_commid='57463'",
      idField: 'id',
      nameField: 'lib',
    },
    nameOverrides: {
      'Devant-les-ponts': 'Devant-les-Ponts',
      'Les Iles': 'Les Îles',
      'Metz-centre': 'Metz-Centre',
      'Patrotte Metz-nord': 'Patrotte Metz-Nord',
      'Grange-aux-bois': 'Grange-aux-Bois',
      'Plantières Queuleu': 'Plantières-Queuleu',
      // OSM's suburb node: Vallières and Les Bordes are two villages, so the
      // "lès" (near) of a commune name would be wrong here.
      'Vallières Les Bordes': 'Vallières-Les Bordes',
      'Grigy Technopôle': 'Grigy-Technopôle',
    },
  },
]

export function citySource(insee: string): CityWfsSource | undefined {
  return CITY_SOURCES.find((city) => city.insee === insee)
}

export function displayName(city: CityWfsSource, published: string): string {
  const trimmed = published.trim()
  return city.nameOverrides[trimmed] ?? trimmed
}
