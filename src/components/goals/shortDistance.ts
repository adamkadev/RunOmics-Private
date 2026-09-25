import { t } from '@/i18n'

/** A race distance as the goals page labels it where space is tight: "Half", never "HM". */
export function shortDist(distance: string): string {
  return distance === 'Half-Marathon' ? t.goals.half : distance
}
