/** The season headline's content, which the AI season insight also builds on. */

export type SeasonHeadlineTone = 'positive' | 'caution'

export interface SeasonHeadlineBullet {
  tone: SeasonHeadlineTone
  text: string
}

export interface SeasonHeadlineData {
  title: string
  bullets: SeasonHeadlineBullet[]
}
