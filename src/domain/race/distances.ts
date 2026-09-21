export type RaceDistanceKey = '5k' | '10k' | 'half' | 'marathon'

export const RACE_DISTANCES: RaceDistanceKey[] = ['5k', '10k', 'half', 'marathon']

export const RACE_DISTANCE_KM: Record<RaceDistanceKey, number> = {
  '5k': 5,
  '10k': 10,
  half: 21.0975,
  marathon: 42.195,
}
