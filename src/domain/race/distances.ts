/**
 * The four distances Garmin predicts a finish time for.
 *
 * Lives in the domain rather than beside the use case because the charts need
 * the kilometre table at render time: importing it from the use case would drag
 * the `fs`-backed repository into the client bundle.
 */
export type RaceDistanceKey = '5k' | '10k' | 'half' | 'marathon'

export const RACE_DISTANCES: RaceDistanceKey[] = ['5k', '10k', 'half', 'marathon']

export const RACE_DISTANCE_KM: Record<RaceDistanceKey, number> = {
  '5k': 5,
  '10k': 10,
  half: 21.0975,
  marathon: 42.195,
}
